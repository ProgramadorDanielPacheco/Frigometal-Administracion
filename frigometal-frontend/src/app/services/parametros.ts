import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParametroPoliuretano {
  id?: number;
  parte: string;
  largo: number | null;
  ancho: number | null;
  espesor: number | null;
  poliol: number | null;
  isocianato: number | null;
}

@Injectable({ providedIn: 'root' })
export class Parametros {
  private apiUrl = 'https://frigometal-administracion.vercel.app/parametros-poliuretano/';

  constructor(private http: HttpClient) { }

  getParametros(idProducto: number): Observable<ParametroPoliuretano[]> {
    return this.http.get<ParametroPoliuretano[]>(`${this.apiUrl}${idProducto}`);
  }

  guardarParametros(idProducto: number, datos: ParametroPoliuretano[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${idProducto}`, datos);
  }
}