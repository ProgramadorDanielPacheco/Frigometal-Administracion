import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TareaReunion {
  accion: string;
  responsable: string;
  fecha_accion: string;
}

export interface Reunion {
  id_reunion?: number;
  motivo: string;
  fecha: string;
  hora: string;
  participantes: string;
  estado?: string;
  detalle?: string;
  tareas: TareaReunion[]; // 👈 Array de tareas
}

@Injectable({ providedIn: 'root' })
export class ReunionService {
  private apiUrl = 'http://127.0.0.1:8000/reuniones/';

  constructor(private http: HttpClient) { }

  getReuniones(): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(this.apiUrl);
  }

  crearReunion(reunion: Reunion): Observable<Reunion> {
    return this.http.post<Reunion>(this.apiUrl, reunion);
  }

  actualizarReunion(id: number, datos: any): Observable<Reunion> {
    return this.http.put<Reunion>(`${this.apiUrl}${id}`, datos);
  }
}