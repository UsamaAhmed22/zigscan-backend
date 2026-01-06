import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface UserSession {
  userId: string;
  username: string;
  email: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user-sessions:';
  private readonly SESSION_TTL = 86400; // 24 hours in seconds

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Create a new session
   */
  async createSession(
    sessionToken: string,
    userId: string,
    username: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const session: UserSession = {
      userId,
      username,
      email,
      loginTime: new Date(),
      lastActivity: new Date(),
      ipAddress,
      userAgent,
    };

    const sessionKey = this.getSessionKey(sessionToken);
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Store session data
    await this.cacheManager.set(sessionKey, JSON.stringify(session), this.SESSION_TTL * 1000);

    // Track all user sessions for multi-device logout
    const userSessions = await this.getUserSessions(userId);
    userSessions.push(sessionToken);
    await this.cacheManager.set(
      userSessionsKey,
      JSON.stringify(userSessions),
      this.SESSION_TTL * 1000,
    );

    this.logger.log(`Session created for user: ${username} (${userId})`);
  }

  /**
   * Get session by token
   */
  async getSession(sessionToken: string): Promise<UserSession | null> {
    const sessionKey = this.getSessionKey(sessionToken);
    const sessionData = await this.cacheManager.get<string>(sessionKey);

    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData);
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionToken: string): Promise<void> {
    const session = await this.getSession(sessionToken);

    if (!session) {
      return;
    }

    session.lastActivity = new Date();
    const sessionKey = this.getSessionKey(sessionToken);
    await this.cacheManager.set(sessionKey, JSON.stringify(session), this.SESSION_TTL * 1000);
  }

  /**
   * Delete a specific session (logout)
   */
  async deleteSession(sessionToken: string): Promise<void> {
    const session = await this.getSession(sessionToken);

    if (!session) {
      return;
    }

    const sessionKey = this.getSessionKey(sessionToken);
    await this.cacheManager.del(sessionKey);

    // Remove from user's session list
    const userSessions = await this.getUserSessions(session.userId);
    const updatedSessions = userSessions.filter(token => token !== sessionToken);
    const userSessionsKey = this.getUserSessionsKey(session.userId);

    if (updatedSessions.length > 0) {
      await this.cacheManager.set(
        userSessionsKey,
        JSON.stringify(updatedSessions),
        this.SESSION_TTL * 1000,
      );
    } else {
      await this.cacheManager.del(userSessionsKey);
    }

    this.logger.log(`Session deleted for user: ${session.username}`);
  }

  /**
   * Delete all sessions for a user (logout from all devices)
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);

    // Delete all session data
    for (const sessionToken of userSessions) {
      const sessionKey = this.getSessionKey(sessionToken);
      await this.cacheManager.del(sessionKey);
    }

    // Delete user sessions list
    const userSessionsKey = this.getUserSessionsKey(userId);
    await this.cacheManager.del(userSessionsKey);

    this.logger.log(`All sessions deleted for user: ${userId}`);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    const sessionTokens = await this.getUserSessions(userId);
    const sessions: UserSession[] = [];

    for (const token of sessionTokens) {
      const session = await this.getSession(token);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Validate if session exists and is valid
   */
  async isSessionValid(sessionToken: string): Promise<boolean> {
    const session = await this.getSession(sessionToken);
    return session !== null;
  }

  /**
   * Get user's session tokens
   */
  private async getUserSessions(userId: string): Promise<string[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionsData = await this.cacheManager.get<string>(userSessionsKey);

    if (!sessionsData) {
      return [];
    }

    return JSON.parse(sessionsData);
  }

  /**
   * Generate Redis key for session
   */
  private getSessionKey(sessionToken: string): string {
    return `${this.SESSION_PREFIX}${sessionToken}`;
  }

  /**
   * Generate Redis key for user sessions list
   */
  private getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }
}
