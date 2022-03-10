import { backgroundClass } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceCronJob extends ServiceBase {}
