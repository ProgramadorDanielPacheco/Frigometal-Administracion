import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProformaService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/proformas/'; 

  constructor(private http: HttpClient) { }

  getProformas(): Observable<any[]> { return this.http.get<any[]>(this.apiUrl); }
  crearProforma(proforma: any): Observable<any> { return this.http.post<any>(this.apiUrl, proforma); }
  actualizarProforma(id: number, proforma: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}`, proforma);
  }
}