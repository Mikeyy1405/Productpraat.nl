import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login succesvol' })
  @ApiResponse({ status: 401, description: 'Ongeldige credentials' })
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login request voor: ${loginDto.email}`);
    return this.authService.login(loginDto.email, loginDto.password);
  }
  
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin logout' })
  @ApiResponse({ status: 200, description: 'Logout succesvol' })
  async logout() {
    this.logger.log('Logout request');
    return { success: true, message: 'Uitgelogd' };
  }
}
