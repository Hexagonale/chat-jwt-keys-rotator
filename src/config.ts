import z from 'zod';

const configSchema = z.object({
	jwksPath: z.string(),
	namespace: z.string(),
	secretName: z.string(),
	maxKeys: z.coerce.number().positive().int(),
});

type ConfigIntermediate = Record<keyof Config, string | undefined>;

export type Config = z.infer<typeof configSchema>;

export const configFactory = (): Config => {
	const config: ConfigIntermediate = {
		jwksPath: process.env.JWKS_PATH ?? '/tmp/jwks.json',
		namespace: process.env.NAMESPACE,
		secretName: process.env.SECRET_NAME ?? 'jwt-keys',
		maxKeys: process.env.MAX_KEYS ?? '2',
	};

	return configSchema.parse(config);
};
