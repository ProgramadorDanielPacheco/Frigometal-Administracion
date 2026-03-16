import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResumenDashboard {
  pedidos_activos: number;
  alertas_inventario: number;
  compras_pendientes: number;
  tareas_activas: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/dashboard/resumen/';

  constructor(private http: HttpClient) { }

  getResumen(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(this.apiUrl);
  }
}