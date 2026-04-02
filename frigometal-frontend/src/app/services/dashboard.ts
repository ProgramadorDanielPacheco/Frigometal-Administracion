import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResumenDashboard {
  pedidos_activos: number;
  alertas_inventario: number;
  compras_pendientes: number;
  ordenes_nuevas: number; // 👈 NUEVO
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = 'http://127.0.0.1:8000/resumen/';

  constructor(private http: HttpClient) { }

  getResumen(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(this.apiUrl);
  }

  // 👇 NUEVA FUNCIÓN PARA APAGAR LA NOTIFICACIÓN 👇
  marcarOrdenesComoVistas(): Observable<any> {
    return this.http.put('http://127.0.0.1:8000/dashboard/limpiar-notificacion-ordenes/', {});
  }
}