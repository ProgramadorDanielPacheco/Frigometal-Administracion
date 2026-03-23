import { Routes } from '@angular/router';
import { ListaProductos } from './components/lista-productos/lista-productos';
import { Inventario } from './components/inventario/inventario';
import { PedidosComponent } from './components/pedidos/pedidos';
import { ComprasComponent } from './components/compras/compras';
import { ProgramacionComponent } from './components/programacion/programacion'; 
import { DashboardComponent } from './components/dashboard/dashboard'; 
import { authGuard } from './guards/auth-guard'; 
import { LoginComponent } from './components/login/login';
import { RegistroComponent } from './components/registro/registro'; 
import { ClientesComponent } from './components/clientes/clientes';
import { ProveedoresComponent } from './components/proveedores/proveedores';
import { MantenimientosComponent } from './components/mantenimientos/mantenimientos'
// 👇 NUEVA IMPORTACIÓN 👇
import { ReunionesComponent } from './components/reuniones/reuniones'; 
import { OrdenesProduccionComponent } from './components/ordenes-produccion/ordenes-produccion';
import { EstadisticasComponent } from './components/estadisticas/estadisticas';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'productos', component: ListaProductos, canActivate: [authGuard] },
  { path: 'inventario', component: Inventario, canActivate: [authGuard] },
  { path: 'pedidos', component: PedidosComponent, canActivate: [authGuard] },
  { path: 'compras', component: ComprasComponent, canActivate: [authGuard] },
  { path: 'programacion', component: ProgramacionComponent, canActivate: [authGuard] },
  { path: 'registro', component: RegistroComponent, canActivate: [authGuard] },
  { path: 'clientes', component: ClientesComponent, canActivate: [authGuard] },
  { path: 'proveedor', component: ProveedoresComponent, canActivate: [authGuard] },
  
  // 👇 NUEVA RUTA DE AGENDA 👇
  { path: 'reuniones', component: ReunionesComponent, canActivate: [authGuard] },
  // 👇 NUEVA RUTA DE AGENDA 👇
  { path: 'mantenimientos', component: MantenimientosComponent, canActivate: [authGuard] },
  { path: 'ordenes-produccion', component: OrdenesProduccionComponent, canActivate: [authGuard] },
  { path: 'estadisticas', component: EstadisticasComponent, canActivate: [authGuard] },
  // Redirect por defecto a login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Si pone una URL que no existe, mándalo al login
  { path: '**', redirectTo: '/login' }
];