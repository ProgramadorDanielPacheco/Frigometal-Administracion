import { Component, OnInit } from '@angular/core';
import { OrdenCompra, CompraService } from '../../services/compra';

// Módulos de Angular Material
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips'; // Para poner etiquetas de colores bonitas
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, CommonModule],
  templateUrl: './compras.html',
  styleUrls: ['./compras.scss']
})
export class ComprasComponent implements OnInit {
  dataSource = new MatTableDataSource<OrdenCompra>([]);
  columnasMostradas: string[] = ['id_orden', 'proveedor', 'estado', 'acciones'];

  constructor(private compraService: CompraService) {}

  ngOnInit(): void {
    this.cargarOrdenes();
  }

  cargarOrdenes(): void {
    this.compraService.getOrdenes().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
      },
      error: (err) => console.error('Error al cargar órdenes de compra', err)
    });
  }

  // Una función simulada para "Aprobar" la compra
  aprobarOrden(id: number): void {
    alert(`En una versión futura, esto enviará un correo con la Orden #${id} al proveedor para comprar el material faltante.`);
  }
}