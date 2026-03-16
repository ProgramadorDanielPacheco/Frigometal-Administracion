import { Routes } from '@angular/router';
import { ListaProductos } from './components/lista-productos/lista-productos';
import { Inventario } from './components/inventario/inventario';
import { PedidosComponent } from './components/pedidos/pedidos';
import { ComprasComponent } from './components/compras/compras';
import { ProgramacionComponent } from './components/programacion/programacion'; // <-- Importar
import { DashboardComponent } from './components/dashboard/dashboard'; // <-- Importar
import { authGuard } from './guards/auth-guard'; // <-- Importa el Guard
import { LoginComponent } from './components/login/login';
import { RegistroComponent } from './components/registro/registro'; // <-- Importar
import { ClientesComponent } from './components/clientes/clientes';
import { ProveedoresComponent } from './components/proveedores/proveedores';

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
  
  // Redirect por defecto a login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Si pone una URL que no existe, mándalo al login
  { path: '**', redirectTo: '/login' }
];