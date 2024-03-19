import crypto from 'crypto';
import * as k8s from '@kubernetes/client-node';
import { JSONWebKeySet, JWK, exportJWK } from 'jose';
import { Logger } from './logger';
import { Config } from './config';

export const rotatorFactory = (config: Config) => {
	const logger = new Logger('rotator');

	const kc = new k8s.KubeConfig();
	kc.loadFromCluster();

	const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

	const readJwks = async () => {
		const response = await k8sApi.readNamespacedSecret(config.secretName, config.namespace);
		const secret = response.body;
		const encoded = secret.data?.['jwks.json'];
		if (!encoded) {
			throw new Error('JWKS not found in the secret.');
		}

		const raw = Buffer.from(encoded, 'base64').toString('utf-8');
		return JSON.parse(raw) as JSONWebKeySet;
	};

	const getUniqueKeyId = () => {
		// Use time to guarantee global uniqueness.
		const time = Date.now().toString(16);
		// Use random to guarantee unpredictability.
		const random = crypto.randomBytes(8).toString('hex');

		return `${random}${time}`;
	};

	const generateJwk = async (keyId: string, keyPair: crypto.KeyPairSyncResult<string, string>) => {
		const publicKey = crypto.createPublicKey(keyPair.publicKey);
		const exported = await exportJWK(publicKey);

		return {
			...exported,
			kid: keyId,
			alg: 'EdDSA',
		};
	};

	const mergeJwks = (existingJwks: JSONWebKeySet, newJwk: JWK): JSONWebKeySet => {
		const updatedKeys = [...existingJwks.keys, newJwk];

		return {
			keys: updatedKeys.slice(0, config.maxKeys),
		};
	};

	const patchSecret = async (privateKey: string, jwks: JSONWebKeySet) => {
		await k8sApi.patchNamespacedSecret(
			config.secretName,
			config.namespace,
			{
				stringData: {
					'private-key.pem': privateKey,
					'jwks.json': JSON.stringify(jwks),
				},
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				headers: {
					'Content-Type': 'application/strategic-merge-patch+json',
				},
			}
		);
	};

	return async () => {
		const existingJwks = await readJwks();
		logger.info('Loaded current JWKS', existingJwks);

		const keyId = getUniqueKeyId();
		logger.info('Generated new key ID', keyId);

		const keyPair = crypto.generateKeyPairSync('ed448', {
			privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
			publicKeyEncoding: { format: 'pem', type: 'spki' },
		});
		const jwk = await generateJwk(keyId, keyPair);
		logger.info('New JWK generated', { jwk });

		const newJwks = mergeJwks(existingJwks, jwk);
		logger.info('JWKS merged', newJwks);

		try {
			await patchSecret(keyPair.privateKey, newJwks);

			logger.info('Secrets patched');
		} catch (error) {
			if (error instanceof k8s.HttpError) {
				logger.error('Error while patching secrets', error.message, error.statusCode, error.body);
				return;
			}

			logger.error('Unknown error while patching secrets', { error });
		}
	};
};
