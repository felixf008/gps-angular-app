import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UbicacionService } from '../../services/ubicacion.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements OnInit, OnDestroy {
  mapa: any;
  ubicaciones: any[] = [];
  descripcion: string = '';
  latitud: number | null = null;
  longitud: number | null = null;
  cargando = false;
  mensaje: string = '';
  tipoMensaje: 'exito' | 'error' | 'info' = 'info';
  mostrarFormularioManual = false;
  usarDatosEjemplo = false;

  // Variables para GPS en tiempo real
  gpsActivo = false;
  watchId: number | null = null;
  intervaloActualizacion = 5000; // 5 segundos
  marcadorActual: any = null;
  historialUbicaciones: any[] = [];
  velocidad: number = 0;
  precision: number = 0;

  constructor(private ubicacionService: UbicacionService) { }

  ngOnInit(): void {
    this.inicializarMapa();
    this.cargarUbicaciones();
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  inicializarMapa() {
    this.mapa = L.map('mapa').setView([19.4326, -99.1332], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapa);
  }

  cargarUbicaciones() {
    this.ubicacionService.obtenerUbicaciones()
      .then(res => {
        this.ubicaciones = res.data;
        if (this.ubicaciones.length === 0 && this.usarDatosEjemplo) {
          this.ubicaciones = this.ubicacionService.obtenerDatosEjemplo();
        }
        this.dibujarUbicaciones();
      })
      .catch(err => {
        console.error('Error al cargar ubicaciones:', err);
        if (this.usarDatosEjemplo) {
          this.ubicaciones = this.ubicacionService.obtenerDatosEjemplo();
          this.dibujarUbicaciones();
        }
      });
  }

  dibujarUbicaciones() {
    // Limpiar marcadores anteriores (excepto el marcador actual)
    this.mapa.eachLayer((layer: any) => {
      if ((layer instanceof L.CircleMarker || layer instanceof L.Marker) && layer !== this.marcadorActual) {
        this.mapa.removeLayer(layer);
      }
    });

    this.ubicaciones.forEach(u => {
      L.circleMarker([u.latitud, u.longitud], {
        radius: 8,
        fillColor: '#3388ff',
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).bindPopup(`
        <b>${u.descripcion || 'Sin descripción'}</b><br>
        Lat: ${u.latitud.toFixed(4)}<br>
        Lon: ${u.longitud.toFixed(4)}<br>
        ${u.fecha ? 'Fecha: ' + new Date(u.fecha).toLocaleString() : ''}
      `).addTo(this.mapa);
    });
  }

  // Iniciar tracking GPS en tiempo real
  iniciarGPSEnTiempoReal() {
    if (!navigator.geolocation) {
      this.mostrarMensaje('Geolocalización no disponible', 'error');
      return;
    }

    if (this.gpsActivo) {
      this.detenerGPSEnTiempoReal();
      return;
    }

    this.gpsActivo = true;
    this.mostrarMensaje('GPS en tiempo real activado', 'info');

    // Usar watchPosition para actualizaciones continuas
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        this.velocidad = position.coords.speed || 0;
        this.precision = position.coords.accuracy || 0;

        this.latitud = lat;
        this.longitud = lon;

        // Actualizar marcador actual
        if (this.marcadorActual) {
          this.mapa.removeLayer(this.marcadorActual);
        }

        this.marcadorActual = L.circleMarker([lat, lon], {
          radius: 10,
          fillColor: '#00ff00',
          color: '#000',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9
        }).bindPopup(
          `<b>Mi ubicación actual</b><br>
           Lat: ${lat.toFixed(4)}<br>
           Lon: ${lon.toFixed(4)}<br>
           Velocidad: ${(this.velocidad ? (this.velocidad * 3.6).toFixed(2) : 0)} km/h<br>
           Precisión: ${this.precision.toFixed(0)}m`
        ).addTo(this.mapa);

        // Centrar mapa en ubicación actual
        this.mapa.setView([lat, lon], 15);

        // Agregar al historial
        this.historialUbicaciones.push({ lat, lon, fecha: new Date() });

        // Guardar automáticamente cada ubicación
        this.guardarUbicacionAutomatica(lat, lon);
      },
      (error) => {
        console.error('Error de GPS:', error);
        this.mostrarMensaje(
          `Error GPS: ${this.getErrorMessage(error.code)}`,
          'error'
        );
        this.gpsActivo = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }

  // Detener tracking GPS
  detenerGPSEnTiempoReal() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.gpsActivo = false;
    this.mostrarMensaje('GPS en tiempo real detenido', 'info');
  }

  // Guardar ubicación automáticamente
  private guardarUbicacionAutomatica(lat: number, lon: number) {
    // Crear descripción automática basada en la hora
    const hora = new Date().toLocaleTimeString();
    const descripcionAuto = this.descripcion || `Ubicación en tiempo real - ${hora}`;

    this.ubicacionService.guardarUbicacion(lat, lon, descripcionAuto)
      .then(() => {
        console.log('Ubicación guardada automáticamente');
        this.cargarUbicaciones();
      })
      .catch(err => {
        console.error('Error al guardar automáticamente:', err);
      });
  }

  async guardarUbicacion() {
    try {
      this.cargando = true;
      this.mensaje = '';

      let latitud: number;
      let longitud: number;

      if (this.mostrarFormularioManual && this.latitud !== null && this.longitud !== null) {
        latitud = this.latitud;
        longitud = this.longitud;
      } else {
        this.mostrarMensaje('Obteniendo ubicación GPS...', 'info');
        try {
          const gps = await this.ubicacionService.obtenerGPSConReintentos(2);
          latitud = gps.latitud;
          longitud = gps.longitud;
        } catch (error: any) {
          this.mostrarMensaje(
            `${error.message || error}. Por favor ingresa las coordenadas manualmente.`,
            'error'
          );
          this.mostrarFormularioManual = true;
          this.cargando = false;
          return;
        }
      }

      // Guardar en la BD
      await this.ubicacionService.guardarUbicacion(
        latitud,
        longitud,
        this.descripcion
      );

      this.mostrarMensaje('✓ Ubicación guardada correctamente', 'exito');
      this.descripcion = '';
      this.latitud = null;
      this.longitud = null;
      this.mostrarFormularioManual = false;
      this.cargarUbicaciones();
    } catch (err: any) {
      console.error('Error:', err);
      this.mostrarMensaje(
        `Error al guardar: ${err.message || err}`,
        'error'
      );
    } finally {
      this.cargando = false;
    }
  }

  eliminarUbicacion(id: number) {
    if (confirm('¿Eliminar esta ubicación?')) {
      this.ubicacionService.eliminarUbicacion(id)
        .then(() => {
          this.mostrarMensaje('Ubicación eliminada', 'exito');
          this.cargarUbicaciones();
        })
        .catch(err => {
          this.mostrarMensaje('Error al eliminar', 'error');
          console.error(err);
        });
    }
  }

  mostrarMensaje(texto: string, tipo: 'exito' | 'error' | 'info') {
    this.mensaje = texto;
    this.tipoMensaje = tipo;
    setTimeout(() => {
      this.mensaje = '';
    }, 4000);
  }

  toggleDatosEjemplo() {
    this.usarDatosEjemplo = !this.usarDatosEjemplo;
    if (this.usarDatosEjemplo) {
      this.ubicaciones = this.ubicacionService.obtenerDatosEjemplo();
      this.dibujarUbicaciones();
      this.mostrarMensaje('Mostrando datos de ejemplo', 'info');
    } else {
      this.cargarUbicaciones();
    }
  }

  obtenerMiUbicacion() {
    this.cargando = true;
    this.mostrarMensaje('Obteniendo tu ubicación...', 'info');
    this.ubicacionService.obtenerGPS()
      .then(gps => {
        this.latitud = gps.latitud;
        this.longitud = gps.longitud;
        this.mostrarMensaje('✓ Ubicación obtenida', 'exito');
        this.mapa.setView([this.latitud, this.longitud], 15);
      })
      .catch(err => {
        this.mostrarMensaje(
          `No se pudo obtener GPS: ${err.message || err}`,
          'error'
        );
        this.mostrarFormularioManual = true;
      })
      .finally(() => {
        this.cargando = false;
      });
  }

  centrarEnUbicacion(latitud: number, longitud: number) {
    this.mapa.setView([latitud, longitud], 15);
  }

  limpiarHistorial() {
    if (confirm('¿Limpiar el historial de ubicaciones de esta sesión?')) {
      this.historialUbicaciones = [];
      this.mostrarMensaje('Historial limpiado', 'info');
    }
  }

  exportarHistorial() {
    if (this.historialUbicaciones.length === 0) {\n      this.mostrarMensaje('No hay historial para exportar', 'error');
      return;
    }

    const datos = JSON.stringify(this.historialUbicaciones, null, 2);
    const blob = new Blob([datos], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-gps-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.mostrarMensaje('Historial exportado', 'exito');
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Permiso denegado';
      case 2:
        return 'Posición no disponible';
      case 3:
        return 'Tiempo agotado';
      default:
        return 'Error desconocido';
    }
  }
}
