import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class KpiService {
  private apiUrl = 'http://127.0.0.1:8000/kpis/';

  constructor(private http: HttpClient) { }

  getIngresos(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}ingresos`); }
  guardarIngresos(data: any): Observable<any> { return this.http.post(`${this.apiUrl}ingresos`, data); }

  getProductividad(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}productividad`); }
  guardarProductividad(data: any): Observable<any> { return this.http.post(`${this.apiUrl}productividad`, data); }

  getVentas(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}ventas`); }
  guardarVentas(data: any): Observable<any> { return this.http.post(`${this.apiUrl}ventas`, data); }

  getGastos(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}gastos`); }
  guardarGastos(data: any): Observable<any> { return this.http.post(`${this.apiUrl}gastos`, data); }

  getCuentasCobrar(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}cuentas-cobrar`); }
  guardarCuentasCobrar(data: any): Observable<any> { return this.http.post(`${this.apiUrl}cuentas-cobrar`, data); }

}