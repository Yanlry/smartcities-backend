// auth/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'secretKey', // Utilise la même clé que pour la génération des tokens JWT
    });
  }

  async validate(payload: any) {
    console.log('Payload reçu dans JwtStrategy :', payload);
  
    if (!payload.userId) {
      console.error('Erreur : le payload ne contient pas userId');
      throw new UnauthorizedException();
    }
  
    return { id: payload.userId, email: payload.email };
  }
  
  
}
