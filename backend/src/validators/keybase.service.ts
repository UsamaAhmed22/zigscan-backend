import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class KeybaseService {
  private readonly logger = new Logger(KeybaseService.name);

  async getKeybaseAvatar(identity: string | undefined | null): Promise<string | null> {
    if (!identity) {
      return null;
    }

    try {
      const response = await axios.get('https://keybase.io/_/api/1.0/user/lookup.json', {
        params: {
          key_suffix: identity,
          fields: 'pictures',
        },
        timeout: 10_000,
        validateStatus: () => true,
      });

      if (response.status !== 200 || !response.data) {
        return null;
      }

      const data = response.data as Record<string, any>;
      if (Array.isArray(data.them) && data.them.length > 0 && data.them[0]) {
        const userData = data.them[0];
        return userData?.pictures?.primary?.url ?? null;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`Keybase lookup failed for ${identity}: ${message}`);
      return null;
    }
  }
}
