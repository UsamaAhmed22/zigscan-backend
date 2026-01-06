import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  Ip,
  Headers,
  Delete,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('api/v2/auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async signup(@Body() signupDto: SignupDto) {
    return this.usersService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.usersService.login(loginDto, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Logout user (invalidate current session)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.usersService.logout(token);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll(@Request() req: any) {
    return this.usersService.logoutAll(req.user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get all active sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSessions(@Request() req: any) {
    return this.usersService.getActiveSessions(req.user.id);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.usersService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  async resendVerification(@Body() body: { email: string }) {
    return this.usersService.resendVerificationEmail(body.email);
  }

  @Get('verify-email-redirect')
  @ApiOperation({ summary: 'Verify email with token and redirect to dashboard' })
  @ApiResponse({ status: 302, description: 'Email verified, redirecting to dashboard' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmailRedirect(
    @Query('token') token: string,
    @Query('redirect') redirectUrl: string,
    @Res() res: Response,
  ) {
    try {
      await this.usersService.verifyEmail(token);

      // Redirect to dashboard with success message
      const finalRedirectUrl = redirectUrl || 'http://localhost:3000/dashboard';
      return res.redirect(
        `${finalRedirectUrl}?verified=true&message=Email verified successfully! Welcome to ZigScan.`,
      );
    } catch (error) {
      // Redirect to error page or login with error message
      const errorRedirectUrl =
        redirectUrl?.replace('/dashboard', '/login') || 'http://localhost:3000/login';
      return res.redirect(
        `${errorRedirectUrl}?verified=false&error=${encodeURIComponent(error.message || 'Email verification failed')}`,
      );
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.usersService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    return this.usersService.getUserProfile(req.user.id);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete user account',
    description:
      'Permanently delete your account. This action cannot be undone. All your data including saved items will be removed.',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or invalid password' })
  async deleteAccount(@Request() req: any, @Body() deleteAccountDto: DeleteAccountDto) {
    return this.usersService.deleteAccount(req.user.id, deleteAccountDto.password);
  }
}
