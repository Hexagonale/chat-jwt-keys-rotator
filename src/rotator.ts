import crypto from 'crypto';
import * as k8s from '@kubernetes/client-node';
import { JSONWebKeySet, JWK, exportJWK } from 'jose';
import { Logger } from './logger';
import { Config } from './config';

interface PrivateKeyManifest {
	algorithm: string;
	keyId: string;
	content: string;
}

export const rotatorFactory = (config: Config) => {
	const logger = new Logger('rotator');

	const kc = new k8s.KubeConfig();
	kc.loadFromCluster();

	const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

	const algorithm = (() => {
		switch (config.keysType) {
			case 'rsa-2048':
			case 'rsa-4096':
				return 'RSA';

			case 'ed25519':
			case 'ed448':
				return 'EdDSA';
		}
	})();

	const readJwks = async () => {
		const response = await k8sApi.readNamespacedSecret(config.secretName, config.namespace).catch((error) => {
			if (error instanceof k8s.HttpError && error.statusCode === 404) {
				logger.info('Secret not found, creating a new one');

				return k8sApi.createNamespacedSecret(config.namespace, {
					apiVersion: 'v1',
					kind: 'Secret',
					metadata: {
						name: config.secretName,
					},
					stringData: {
						'private-key-manifest.json': '{}',
						'jwks.json': '{ "keys": [] }',
					},
				});
			}

			throw error;
		});

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

	const generateKeyPair = () => {
		switch (config.keysType) {
			case 'rsa-2048':
				return crypto.generateKeyPairSync('rsa', {
					modulusLength: 2048,
					publicKeyEncoding: { format: 'pem', type: 'spki' },
					privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
				});

			case 'rsa-4096':
				return crypto.generateKeyPairSync('rsa', {
					modulusLength: 4096,
					publicKeyEncoding: { format: 'pem', type: 'spki' },
					privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
				});

			case 'ed25519':
				return crypto.generateKeyPairSync('ed25519', {
					publicKeyEncoding: { format: 'pem', type: 'spki' },
					privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
				});

			case 'ed448':
				return crypto.generateKeyPairSync('ed448', {
					publicKeyEncoding: { format: 'pem', type: 'spki' },
					privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
				});
		}
	};

	const generateJwk = async (keyId: string, keyPair: crypto.KeyPairSyncResult<string, string>) => {
		const publicKey = crypto.createPublicKey(keyPair.publicKey);
		const exported = await exportJWK(publicKey);

		const alg = (() => {
			switch (config.keysType) {
				case 'rsa-2048':
					return 'RS256';

				case 'rsa-4096':
					return 'RS512';

				case 'ed25519':
					return 'EdDSA';

				case 'ed448':
					return 'EdDSA';
			}
		})();

		return {
			...exported,
			kid: keyId,
			alg,
		};
	};

	const mergeJwks = (existingJwks: JSONWebKeySet, newJwk: JWK): JSONWebKeySet => {
		const updatedKeys = [newJwk, ...existingJwks.keys];

		return {
			keys: updatedKeys.slice(0, config.maxKeys),
		};
	};

	const patchSecret = async (privateKeyManifest: PrivateKeyManifest, jwks: JSONWebKeySet) => {
		await k8sApi.patchNamespacedSecret(
			config.secretName,
			config.namespace,
			{
				stringData: {
					'private-key-manifest.json': JSON.stringify(privateKeyManifest),
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

		const keyPair = generateKeyPair();
		logger.info('Generated new key pair');

		const jwk = await generateJwk(keyId, keyPair);
		logger.info('New JWK generated', { jwk });

		const newJwks = mergeJwks(existingJwks, jwk);
		logger.info('JWKS merged', newJwks);

		try {
			const privateKeyManifest = {
				algorithm,
				keyId,
				content: keyPair.privateKey,
			};

			await patchSecret(privateKeyManifest, newJwks);

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
