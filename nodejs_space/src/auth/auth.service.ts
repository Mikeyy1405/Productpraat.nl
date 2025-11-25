import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  // Admin credentials - in productie zou dit uit database/env komen
  private readonly ADMIN_EMAIL = 'info@writgo.nl';
  private readonly ADMIN_PASSWORD = 'Productpraat2025!';
  
  async validateAdmin(email: string, password: string): Promise<boolean> {
    this.logger.log(`Login poging voor: ${email}`);
    
    if (email === this.ADMIN_EMAIL && password === this.ADMIN_PASSWORD) {
      this.logger.log(`✅ Succesvolle admin login: ${email}`);
      return true;
    }
    
    this.logger.warn(`❌ Ongeldige login poging: ${email}`);
    throw new UnauthorizedException('Ongeldige inloggegevens');
  }
  
  async login(email: string, password: string) {
    await this.validateAdmin(email, password);
    
    // In een echte productie app zou je hier een JWT token genereren
    // Voor nu geven we een simpel session object terug
    return {
      success: true,
      user: {
        email: this.ADMIN_EMAIL,
        role: 'admin',
      },
      token: Buffer.from(`${email}:${Date.now()}`).toString('base64'),
    };
  }
}
