import z from 'zod';

const configSchema = z.object({
	namespace: z.string(),
	secretName: z.string(),
	maxKeys: z.coerce.number().positive().int(),
	keyAlgorithm: z.enum(['rsa-2048', 'rsa-4096', 'ed25519', 'ed448']),
});

type ConfigIntermediate = Record<keyof Config, string | undefined>;

export type Config = z.infer<typeof configSchema>;

export const configFactory = (): Config => {
	const config: ConfigIntermediate = {
		namespace: process.env.NAMESPACE,
		secretName: process.env.SECRET_NAME ?? 'jwt-keys',
		maxKeys: process.env.MAX_KEYS ?? '2',
		keyAlgorithm: process.env.KEY_ALGORITHM ?? 'ed25519',
	};

	return configSchema.parse(config);
};
