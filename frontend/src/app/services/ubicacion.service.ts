import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root'
})
export class UbicacionService {
  private apiUrl = 'http://localhost:3000/api/ubicaciones';

  constructor() { }

  obtenerUbicaciones() {
    return axios.get(this.apiUrl);
  }

  guardarUbicacion(latitud: number, longitud: number, descripcion: string = '') {
    return axios.post(this.apiUrl, { latitud, longitud, descripcion });
  }

  eliminarUbicacion(id: number) {
    return axios.delete(`${this.apiUrl}/${id}`);
  }

  // Obtener ubicación actual del navegador
  obtenerGPS(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitud: position.coords.latitude,
              longitud: position.coords.longitude
            });
          },
          (error) => {
            console.error('Error de geolocalización:', error);
            reject({
              code: error.code,
              message: this.getErrorMessage(error.code)
            });
          },
          {
            timeout: 10000,
            enableHighAccuracy: false
          }
        );
      } else {
        reject('Geolocalización no disponible en este navegador');
      }
    });
  }

  // Obtener ubicación con reintentos
  obtenerGPSConReintentos(maxReintentos: number = 3): Promise<any> {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < maxReintentos; i++) {
        try {
          const ubicacion = await this.obtenerGPS();
          resolve(ubicacion);
          return;
        } catch (error) {
          console.error(`Intento ${i + 1} falló:`, error);
          if (i === maxReintentos - 1) {
            reject(error);
          }
        }
      }
    });
  }

  // Mensaje amigable según el código de error
  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Permiso de geolocalización denegado. Ve a configuración del navegador.';
      case 2:
        return 'Posición no disponible. Intenta de nuevo.';
      case 3:
        return 'Tiempo de espera agotado. Intenta de nuevo.';
      default:
        return 'Error desconocido.';
    }
  }

  // Datos de prueba - Ubicaciones en México
  obtenerDatosEjemplo(): any[] {
    return [
      {
        id: 0,
        latitud: 19.4326,
        longitud: -99.1332,
        descripcion: 'Ciudad de México - Centro Histórico',
        fecha: new Date().toISOString()
      },
      {
        id: -1,
        latitud: 19.5407,
        longitud: -99.1055,
        descripcion: 'Torre Latinoamericana',
        fecha: new Date().toISOString()
      },
      {
        id: -2,
        latitud: 19.4240,
        longitud: -99.1613,
        descripcion: 'Castillo de Chapultepec',
        fecha: new Date().toISOString()
      },
      {
        id: -3,
        latitud: 19.3631,
        longitud: -99.1931,
        descripcion: 'UNAM - Ciudad Universitaria',
        fecha: new Date().toISOString()
      },
      {
        id: -4,
        latitud: 19.4326,
        longitud: -99.0822,
        descripcion: 'Aeropuerto Internacional Benito Juárez',
        fecha: new Date().toISOString()
      },
      {
        id: -5,
        latitud: 19.3571,
        longitud: -99.1712,
        descripcion: 'Xochimilco - Trajineras',
        fecha: new Date().toISOString()
      },
      {
        id: -6,
        latitud: 19.4284,
        longitud: -99.1454,
        descripcion: 'Palacio Nacional',
        fecha: new Date().toISOString()
      },
      {
        id: -7,
        latitud: 19.4267,
        longitud: -99.1440,
        descripcion: 'Catedral Metropolitana',
        fecha: new Date().toISOString()
      }
    ];
  }
}
