import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Material {
  id_material?: number;
  nombre: string;
  stock_actual: number;
  stock_minimo_alerta: number;
  unidad_medida: string;
  precio_unitario: number; // 👈 Agregado
}

@Injectable({ providedIn: 'root' })
export class MaterialService {
  private apiUrl = 'http://127.0.0.1:8000/materiales/';

  constructor(private http: HttpClient) { }

  getMateriales(): Observable<Material[]> {
    return this.http.get<Material[]>(this.apiUrl);
  }

  // 👇 NUEVA FUNCIÓN PARA GUARDAR EN BASE DE DATOS 👇
  crearMaterial(material: Material): Observable<Material> {
    return this.http.post<Material>(this.apiUrl, material);
  }

  // 👇 NUEVO MÉTODO PARA ACTUALIZAR
  actualizarMaterial(id: number, material: Partial<Material>): Observable<Material> {
    // Se envía el ID en la URL y los datos en el cuerpo (body)
    return this.http.put<Material>(`${this.apiUrl}${id}`, material);
  }

  // 👇 NUEVA FUNCIÓN PARA ELIMINAR MATERIAL 👇
  eliminarMaterial(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}`);
  }

   importarMaterilesExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe llamarse exactamente igual que el parámetro en tu función de Python
    formData.append('file', archivo); 
    
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }
}