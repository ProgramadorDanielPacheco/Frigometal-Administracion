import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProcesoTaller {
  fecha_inicio_1?: string;
  hora_inicio_1?: string;
  fecha_fin_1?: string;
  hora_fin_1?: string;
  
  fecha_inicio_2?: string;
  hora_inicio_2?: string;
  fecha_fin_2?: string;
  hora_fin_2?: string;
  
  responsable?: string;

  // Heredados
  fecha?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
}
export interface OrdenPlanta {
  id_op?: number;
  numero_op: string;
  id_pedido: number;
  id_producto: number;
  cantidad: number;
  cliente_nombre: string;
  fecha_entrega_prevista?: string;
  fecha_inicio_produccion?: string;
  fecha_fin_produccion?: string;
  seguimiento_procesos: Record<string, ProcesoTaller>;
  observaciones_taller?: string;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class ProgramacionService {
  private apiUrl = 'http://127.0.0.1:8000/planta/'; // 👈 Apunta a la nueva ruta
  
  constructor(private http: HttpClient) { }

  getOrdenes(): Observable<OrdenPlanta[]> {
    return this.http.get<OrdenPlanta[]>(this.apiUrl);
  }

  // Ahora actualizamos todo el objeto de la OP, incluyendo el JSON de procesos
  actualizarOrden(id_op: number, orden: Partial<OrdenPlanta>): Observable<any> {
    return this.http.put(`${this.apiUrl}${id_op}`, orden);
  }
}
