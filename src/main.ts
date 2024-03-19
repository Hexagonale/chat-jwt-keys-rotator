import { Logger } from './logger';
import { configFactory } from './config';
import { rotatorFactory } from './rotator';

const logger = new Logger('main');

const main = async () => {
	const config = configFactory();
	logger.info('Loaded config', config);

	const rotator = rotatorFactory(config);
	await rotator();
};

main();
