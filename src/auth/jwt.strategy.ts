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
      secretOrKey: 'secretKey',
    });
  }

  async validate(payload: any) {
    console.log('Payload reçu dans JwtStrategy :', payload);

    const userId = payload.userId || payload.sub; // Prise en charge de `sub` comme identifiant

    if (!userId) {
      console.error('Erreur : le payload est invalide ou ne contient pas userId');
      throw new UnauthorizedException('JWT invalide');
    }

    return { id: userId, email: payload.email }; // Retourne l'utilisateur validé
  }
}