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

export interface PerfilCuartoFrio {
  id?: number;
  cantidad: number | null;
  nombre_canaleta: string;
  dim_1: number | null;
  dim_2: number | null;
  dim_3: number | null;
  largo: number | null;
}

@Injectable({ providedIn: 'root' })
export class Parametros {
  private apiUrl = 'https://frigometal-administracion.vercel.app/parametros-poliuretano/';
  private apiUrlPerfiles = 'https://frigometal-administracion.vercel.app/parametros-perfiles/';

  constructor(private http: HttpClient) { }

  getParametros(idProducto: number): Observable<ParametroPoliuretano[]> {
    return this.http.get<ParametroPoliuretano[]>(`${this.apiUrl}${idProducto}`);
  }

  guardarParametros(idProducto: number, datos: ParametroPoliuretano[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${idProducto}`, datos);
  }

  getPerfiles(idProducto: number): Observable<PerfilCuartoFrio[]> {
    return this.http.get<PerfilCuartoFrio[]>(`${this.apiUrlPerfiles}${idProducto}`);
  }
  guardarPerfiles(idProducto: number, datos: PerfilCuartoFrio[]): Observable<any> {
    return this.http.post(`${this.apiUrlPerfiles}${idProducto}`, datos);
  }
}