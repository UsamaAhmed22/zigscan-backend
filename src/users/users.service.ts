import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SessionService } from './session.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from './email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12; // Higher is more secure but slower
  private readonly TOKEN_EXPIRY_MINUTES = 3; // Token valid for 3 minutes
  private readonly RATE_LIMIT_HOURS = 1 / 60; // Can only request reset once per minute (1/60 hours)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Register a new user
   */
  async signup(signupDto: SignupDto): Promise<{ message: string; userId: string }> {
    const { email, username, password } = signupDto;

    // Check if email already exists
    const existingEmail = await this.userRepository.findOne({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await this.userRepository.findOne({ where: { username } });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate email verification token
    const verificationToken = this.generateSecureToken();

    // Create new user
    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      verificationToken,
      isVerified: false,
    });

    await this.userRepository.save(user);

    this.logger.log(`New user registered: ${username} (${email})`);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(email, verificationToken, username);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message || error}`);
      // Don't block registration if email fails
    }

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  /**
   * Login user
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    message: string;
    user: {
      id: string;
      username: string;
      email: string;
      isVerified: boolean;
    };
    accessToken: string;
    expiresIn: string;
  }> {
    const { identifier, password } = loginDto;

    // Find user by email or username
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :identifier OR user.username = :identifier', { identifier })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      // Use generic error message to prevent user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified (enforce verification before login)
    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in. Check your inbox for the verification link.',
      );
    }

    // Update last login
    await this.userRepository.update(user.id, {
      lastLogin: new Date(),
    });

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create session in Redis
    await this.sessionService.createSession(
      accessToken,
      user.id,
      user.username,
      user.email,
      ipAddress,
      userAgent,
    );

    this.logger.log(`User logged in: ${user.username}`);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
      },
      accessToken,
      expiresIn: '24h',
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.verificationToken = :token', { token })
      .addSelect('user.verificationToken')
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Mark as verified and clear token
    await this.userRepository.update(user.id, {
      isVerified: true,
      verificationToken: null,
    });

    this.logger.log(`Email verified for user: ${user.username}`);

    return { message: 'Email verified successfully. You can now login.' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.verificationToken')
      .getOne();

    if (!user) {
      // Don't reveal if email exists - return success anyway for security
      return {
        message: 'If the email exists and is unverified, a verification email has been sent.',
      };
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const newVerificationToken = this.generateSecureToken();

    await this.userRepository.update(user.id, {
      verificationToken: newVerificationToken,
    });

    this.logger.log(`Verification email resent for user: ${user.username}`);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(email, newVerificationToken, user.username);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${email}: ${error.message || error}`,
      );
      // Still return success message for security
    }

    return {
      message: 'If the email exists and is unverified, a verification email has been sent.',
    };
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.lastPasswordResetRequest')
      .getOne();

    if (!user) {
      // Don't reveal if email exists - return success anyway for security
      return {
        message: 'If the email exists, a 6-digit verification code has been sent to your email.',
      };
    }

    // Check rate limiting - only allow one password reset request per minute
    if (user.lastPasswordResetRequest) {
      const hoursSinceLastRequest =
        (new Date().getTime() - new Date(user.lastPasswordResetRequest).getTime()) /
        (1000 * 60 * 60);

      if (hoursSinceLastRequest < this.RATE_LIMIT_HOURS) {
        const minutesRemaining = Math.ceil((this.RATE_LIMIT_HOURS - hoursSinceLastRequest) * 60);
        throw new BadRequestException(
          `You can only request a password reset once every 1 minute. Please try again in ${minutesRemaining} second(s).`,
        );
      }
    }

    // Generate 6-digit reset code
    const resetCode = this.generateSixDigitCode();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setMinutes(resetTokenExpiry.getMinutes() + this.TOKEN_EXPIRY_MINUTES);

    await this.userRepository.update(user.id, {
      resetToken: resetCode,
      resetTokenExpiry,
      lastPasswordResetRequest: new Date(),
    });

    this.logger.log(`Password reset requested for user: ${user.username}`);

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(email, resetCode, user.username);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${error.message || error}`,
      );
      // Still return success message for security, but log the error
    }

    return {
      message: 'If the email exists, a 6-digit verification code has been sent to your email.',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.resetToken = :token', { token })
      .addSelect(['user.resetToken', 'user.resetTokenExpiry', 'user.password'])
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Reset token has expired. Please request a new one.');
    }

    // Check if new password is the same as the current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      this.logger.warn(`User ${user.username} attempted to reset password with the same password`);
      throw new BadRequestException(
        'New password cannot be the same as your current password. Please choose a different password.',
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await this.userRepository.update(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    this.logger.log(`Password reset successful for user: ${user.username}`);

    return { message: 'Password reset successful. You can now login with your new password.' };
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(accessToken: string): Promise<{ message: string }> {
    await this.sessionService.deleteSession(accessToken);
    this.logger.log('User logged out');
    return { message: 'Logout successful' };
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.sessionService.deleteAllUserSessions(userId);
    this.logger.log(`User logged out from all devices: ${userId}`);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(userId: string) {
    const sessions = await this.sessionService.getUserActiveSessions(userId);
    return {
      total: sessions.length,
      sessions: sessions.map(session => ({
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })),
    };
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateSixDigitCode(): string {
    // Generate a random 6-digit number
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string, password: string): Promise<{ message: string }> {
    // Find user with password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password before deletion
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password. Account deletion cancelled.');
    }

    // Logout from all devices first
    await this.sessionService.deleteAllUserSessions(userId);

    // Delete user (CASCADE will delete related saved_items automatically)
    await this.userRepository.delete(userId);

    this.logger.log(`User account deleted: ${user.username} (${user.email})`);

    return {
      message: 'Your account has been permanently deleted. All your data has been removed.',
    };
  }

  /**
   * Validate user by ID (for guards)
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }
}
