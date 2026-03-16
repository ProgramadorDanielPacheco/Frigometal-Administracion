import { Component, OnInit } from '@angular/core';
import { Material, MaterialService } from '../../services/material';
import { MatTableModule, MatTableDataSource } from '@angular/material/table'; // <-- IMPORTANTE
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ReportesService } from '../../services/reportes';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, 
    MatIconModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatSnackBarModule
  ],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.scss']
})
export class Inventario implements OnInit {
  // Usamos el DataSource oficial de Material
  dataSource = new MatTableDataSource<Material>([]);
  columnasMostradas: string[] = ['id_material', 'nombre', 'stock_actual', 'stock_minimo_alerta', 'estado'];

  mostrarFormulario: boolean = false;
  guardando: boolean = false;
  nuevoMaterial: Material = {
    nombre: '',
    stock_actual: 0,
    stock_minimo_alerta: 5,
    unidad_medida: 'Unidades'
  };
  constructor(
    private materialService: MaterialService,
    private reportesService: ReportesService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargarInventario();
  }

  cargarInventario(): void {
    this.materialService.getMateriales().subscribe({
      next: (datos) => {
        // CORRECCIÓN: Forzamos a que el stock se lea como número matemático
        const datosCorregidos = datos.map(mat => ({
          ...mat,
          stock_actual: Number(mat.stock_actual),
          stock_minimo_alerta: Number(mat.stock_minimo_alerta)
        }));
        
        // Asignamos los datos ya corregidos a la tabla
        this.dataSource.data = datosCorregidos;
      },
      error: (err) => console.error('Error cargando inventario', err)
    });
  }
  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  guardarMaterial(): void {
    if (!this.nuevoMaterial.nombre || this.nuevoMaterial.stock_actual < 0 || this.nuevoMaterial.stock_minimo_alerta < 0) {
      this.snackBar.open('⚠️ Completa los datos correctamente', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando = true;
    this.materialService.crearMaterial(this.nuevoMaterial).subscribe({
      next: () => {
        this.snackBar.open('✅ Material registrado en bodega', 'Excelente', { duration: 4000 });
        this.cargarInventario(); // Recargamos la tabla para ver el nuevo material
        this.mostrarFormulario = false; // Ocultamos el formulario
        this.guardando = false;
        // Limpiamos el formulario para el siguiente
        this.nuevoMaterial = { nombre: '', stock_actual: 0, stock_minimo_alerta: 5, unidad_medida: 'Unidades' };
      },
      error: (err) => {
        this.guardando = false;
        this.snackBar.open('❌ Error al guardar en base de datos', 'Cerrar', { duration: 3000 });
      }
    });
  }

  descargarExcel(): void {
    // Le pasamos los datos directamente desde la tabla
    const datos = this.dataSource.data;
    this.reportesService.exportarExcel(datos, 'Reporte_Inventario_Frigometal');
  }

  descargarPDF(): void {
    const datos = this.dataSource.data;
    // Especificamos qué columnas queremos en el PDF
    const columnas = ['id_material', 'nombre', 'stock_actual', 'unidad_medida', 'stock_minimo_alerta'];
    this.reportesService.exportarPDF(datos, columnas, 'Reporte de Inventario - Frigometal', 'Inventario_Frigometal');
  }

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      // Pequeña validación de seguridad en Angular
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Leyendo y subiendo archivo...', '', { duration: 2000 });

      this.materialService.importarMaterilesExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          // Si hubo filas con errores (ej. cédulas falsas o duplicados), le avisamos al usuario
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importaro el inventario correctamente, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          this.cargarInventario(); // Refrescamos la tabla para ver la magia
          event.target.value = ''; // Limpiamos el botón por si quieren subir otro Excel
        },
        error: (err) => {
          console.error(err);
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}