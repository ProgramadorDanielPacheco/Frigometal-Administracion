import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RepuestoAsignado {
  id_material: number | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ReporteTecnico {
  id_reporte?: number;
  fecha: string;
  hora: string;
  cliente_nombre: string;
  cliente_direccion: string;
  tecnico: string;
  equipo: string;
  color: string;
  marca: string;
  numero_serie: string;
  falla_reportada: string;
  diagnostico_checks: string[];
  detalle_falla: string;
  pruebas_realizadas: string;
  diagnostico_txt: string;
  trabajo_recomendado: string;
  repuestos: RepuestoAsignado[];
  presupuesto_total: number;
  estado_actual: string;
  estados_marcados: string[];
}

@Injectable({ providedIn: 'root' })
export class ReporteTecnicoService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/reportes-tecnicos/';

  constructor(private http: HttpClient) { }

  getReportes(): Observable<ReporteTecnico[]> { return this.http.get<ReporteTecnico[]>(this.apiUrl); }
  crearReporte(reporte: ReporteTecnico): Observable<ReporteTecnico> { return this.http.post<ReporteTecnico>(this.apiUrl, reporte); }
  actualizarReporte(id: number, reporte: Partial<ReporteTecnico>): Observable<ReporteTecnico> { return this.http.put<ReporteTecnico>(`${this.apiUrl}${id}`, reporte); }
  eliminarReporte(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}${id}`); }
}