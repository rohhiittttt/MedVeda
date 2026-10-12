import type { HospitalCandidate } from '../../domain/models/hospital.model.ts';
import type { IHospitalCachePort } from '../../domain/ports/search.port.ts';
import { SqliteNavigationStore } from '../db/sqlite-navigation.store.ts';

/**
 * In-Memory Hospital Research Cache Adapter (with optional Redis when ENABLE_REDIS_CACHE=true).
 * Uses in-memory SQLite storage by default so no .db / .db-shm / .db-wal cache files are written to disk.
 */
export class RedisOrSqliteHospitalCacheAdapter implements IHospitalCachePort {
  private readonly sqliteStore: SqliteNavigationStore;
  private redisClient: any | null = null;
  private redisReady = false;
  private readonly ttlSeconds: number;

  constructor(sqliteStore?: SqliteNavigationStore, ttlSeconds = 7 * 24 * 3600) {
    this.sqliteStore = sqliteStore || new SqliteNavigationStore(':memory:');
    this.ttlSeconds = ttlSeconds;
    this.initRedisIfConfigured();
  }

  private initRedisIfConfigured(): void {
    const redisUrl = process.env.REDIS_URL;
    const enableRedis = process.env.ENABLE_REDIS_CACHE === 'true';
    if (!redisUrl || !enableRedis) return;

    import('ioredis')
      .then((mod) => {
        const Redis = mod.default || mod;
        const client = new (Redis as any)(redisUrl, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: true,
          connectTimeout: 1500
        });

        client.on('ready', () => {
          this.redisReady = true;
        });
        client.on('error', () => {
          this.redisReady = false;
        });

        client.connect().catch(() => {
          this.redisReady = false;
        });
        this.redisClient = client;
      })
      .catch(() => {
        this.redisReady = false;
      });
  }

  private getCacheKey(location: string, specialty: string): string {
    const normLoc = (location || 'india').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const normSpec = (specialty || 'general').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `medveda:hospitals:${normLoc}:${normSpec}`;
  }

  async findNearby(
    location: string,
    specialty: string,
    emergencyRequired: boolean
  ): Promise<readonly HospitalCandidate[]> {
    if (this.redisReady && this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.getCacheKey(location, specialty));
        if (raw) {
          const parsed = JSON.parse(raw) as HospitalCandidate[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fall through to in-memory store
      }
    }

    return this.sqliteStore.findNearby(location, specialty, emergencyRequired);
  }

  async save(candidate: HospitalCandidate): Promise<void> {
    await this.sqliteStore.save(candidate);
  }

  async saveBatch(candidates: readonly HospitalCandidate[]): Promise<void> {
    await this.sqliteStore.saveBatch(candidates);
  }

  getSqliteStore(): SqliteNavigationStore {
    return this.sqliteStore;
  }
}

