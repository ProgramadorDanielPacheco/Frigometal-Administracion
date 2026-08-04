import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class KpiService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/kpis/';

  constructor(private http: HttpClient) { }

  getIngresos(negocio: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}ingresos?negocio=${negocio}`); }
  guardarIngresos(data: any): Observable<any> { return this.http.post(`${this.apiUrl}ingresos`, data); }

  getProductividad(negocio: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}productividad?negocio=${negocio}`); }
  guardarProductividad(data: any): Observable<any> { return this.http.post(`${this.apiUrl}productividad`, data); }

  getVentas(negocio: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}ventas?negocio=${negocio}`); }
  guardarVentas(data: any): Observable<any> { return this.http.post(`${this.apiUrl}ventas`, data); }

  getGastos(negocio: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}gastos?negocio=${negocio}`); }
  guardarGastos(data: any): Observable<any> { return this.http.post(`${this.apiUrl}gastos`, data); }

  getCuentasCobrar(negocio: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}cuentas-cobrar?negocio=${negocio}`); }
  guardarCuentasCobrar(data: any): Observable<any> { return this.http.post(`${this.apiUrl}cuentas-cobrar`, data); }
}