import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Material {
  id_material?: number; // Es opcional porque al crearlo aún no tiene ID
  nombre: string;
  stock_actual: number;
  stock_minimo_alerta: number;
  unidad_medida: string;
}

@Injectable({ providedIn: 'root' })
export class MaterialService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/materiales/';

  constructor(private http: HttpClient) { }

  getMateriales(): Observable<Material[]> {
    return this.http.get<Material[]>(this.apiUrl);
  }

  // 👇 NUEVA FUNCIÓN PARA GUARDAR EN BASE DE DATOS 👇
  crearMaterial(material: Material): Observable<Material> {
    return this.http.post<Material>(this.apiUrl, material);
  }

   importarMaterilesExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe llamarse exactamente igual que el parámetro en tu función de Python
    formData.append('file', archivo); 
    
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }
}