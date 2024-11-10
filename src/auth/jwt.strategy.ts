// auth/jwt.strategy.ts

import { Injectable } from '@nestjs/common';
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
    console.log('Payload:', payload); // Log le contenu du payload
    return { id: payload.userId, email: payload.email }; // Utilisez 'userId' au lieu de 'sub'
  }
  
  
}
