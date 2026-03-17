import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Reunion {
  id_reunion?: number;
  motivo: string;
  fecha: string;
  hora: string;
  participantes: string;
  estado?: string;
}

@Injectable({ providedIn: 'root' })
export class ReunionService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/reuniones/';

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