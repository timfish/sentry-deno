// deno-lint-ignore-file 
import { Package } from './package.ts';

export interface SdkInfo {
  name?: string;
  version?: string;
  integrations?: string[];
  packages?: Package[];
}
