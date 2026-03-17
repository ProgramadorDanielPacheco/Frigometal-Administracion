import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Para pipes y directivas
import { FormsModule } from '@angular/forms'; // Para ngModel

// Angular Material
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Mantenimiento, MantenimientoService } from '../../services/mantenimiento';
import { ClienteService } from '../../services/cliente';
import { ProductoService } from '../../services/producto';


@Component({
  selector: 'app-mantenimiento',
  standalone: true, // Importante si estás usando Standalone Components
  imports: [
    CommonModule, 
    FormsModule, 
    MatTableModule, 
    MatButtonModule, 
    MatIconModule, 
    MatCardModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatSelectModule, 
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './mantenimientos.html',
  styleUrls: ['./mantenimientos.scss']
})
export class MantenimientosComponent implements OnInit {
  dataSource = new MatTableDataSource<Mantenimiento>([]);
  columnasMostradas: string[] = ['cliente', 'producto', 'fecha', 'estado', 'acciones'];
  
  clientes: any[] = [];
  productos: any[] = [];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;
  
  nuevoMante: Mantenimiento = {
    id_cliente: '', id_producto: 0, fecha_mantenimiento: '', descripcion: '', estado: 'Programado'
  };

  constructor(
    private manteService: MantenimientoService,
    private clienteService: ClienteService,
    private productoService: ProductoService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    // Cargamos clientes y productos como ya lo tenías...
    this.clienteService.getClientes().subscribe(res => this.clientes = res);
    this.productoService.getProductos().subscribe(res => this.productos = res);

    // 👇 MODIFICACIÓN AQUÍ: Ordenamos antes de mostrar 👇
    this.manteService.getMantenimientos().subscribe(res => {
      const mantenimientosOrdenados = res.sort((a, b) => {
        const aEsUrgente = this.esFechaCercana(a.fecha_mantenimiento);
        const bEsUrgente = this.esFechaCercana(b.fecha_mantenimiento);

        // Regla 1: Si 'A' es urgente y 'B' no, 'A' va primero
        if (aEsUrgente && !bEsUrgente) return -1;
        // Regla 2: Si 'B' es urgente y 'A' no, 'B' va primero
        if (!aEsUrgente && bEsUrgente) return 1;

        // Regla 3: Si ambos son urgentes (o ninguno lo es), ordenamos por fecha más próxima
        return new Date(a.fecha_mantenimiento).getTime() - new Date(b.fecha_mantenimiento).getTime();
      });

      this.dataSource.data = mantenimientosOrdenados;
    });
  }

  esFechaCercana(fechaStr: string): boolean {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 3 && diff >= 0;
  }

  guardar(): void {
    if (this.modoEdicion && this.idEditando) {
      this.manteService.actualizar(this.idEditando, this.nuevoMante).subscribe({
        next: () => {
          this.snackBar.open('✅ Mantenimiento actualizado', 'OK', {duration: 3000});
          this.finalizar();
        },
        error: (err) => this.snackBar.open('❌ ' + err.error.detail, 'Cerrar')
      });
    } else {
      this.manteService.crear(this.nuevoMante).subscribe({
        next: () => {
          this.snackBar.open('📅 Mantenimiento agendado', 'OK', {duration: 3000});
          this.finalizar();
        },
        error: (err) => this.snackBar.open('❌ ' + err.error.detail, 'Cerrar')
      });
    }
  }

  editar(mante: Mantenimiento): void {
    this.modoEdicion = true;
    this.idEditando = mante.id_mantenimiento!;
    this.nuevoMante = { ...mante };
    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalizar(): void {
    this.cargarDatos();
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.nuevoMante = { id_cliente: '', id_producto: 0, fecha_mantenimiento: '', descripcion: '', estado: 'Programado' };
  }

  getNombreCliente(id: number) { return this.clientes.find(c => c.id_cliente === id)?.nombre || 'Cargando...'; }
  getNombreProducto(id: number) { return this.productos.find(p => p.id_producto === id)?.nombre || 'Cargando...'; }

  toggleFormulario(): void {
  // Si lo vamos a abrir, nos aseguramos de que esté limpio para "Agendar Nuevo"
  if (!this.mostrarFormulario) {
    this.modoEdicion = false;
    this.idEditando = null;
    this.nuevoMante = { id_cliente:'', id_producto: 0, fecha_mantenimiento: '', descripcion: '', estado: 'Programado' };
  }
  // Cambiamos el estado de visibilidad
  this.mostrarFormulario = !this.mostrarFormulario;
}
}