from sqlalchemy import Boolean, Column, Integer, String, Numeric, JSON
from database import Base
from sqlalchemy import ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import date
from sqlalchemy import Date, Time, Text


from sqlalchemy import Column, Integer, String, Boolean
# Asegúrate de importar Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(String(20), primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(100), unique=True, index=True, nullable=False) # 👈 NUEVO
    hashed_password = Column(String(200), nullable=False) # 👈 NUEVO (Nunca guardes la contraseña en texto plano)
    rol = Column(String(50), nullable=False)
    horas_maximas_semanales = Column(Integer, default=40)
    activo = Column(Boolean, default=True)

class Cliente(Base):
    __tablename__ = "clientes"

    id_cliente = Column(String(20), primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    telefono = Column(String(20))
    correo = Column(String(100))
    direccion = Column(String)

class Producto(Base):
    __tablename__ = "productos"

    id_producto = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    es_estandar = Column(Boolean, default=True)
    tiempo_fabricacion_horas = Column(Numeric(5, 2), nullable=False)

class Material(Base):
    __tablename__ = "materiales"

    id_material = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    unidad_medida = Column(String(20))
    stock_actual = Column(Numeric(10, 2), default=0)
    stock_minimo_alerta = Column(Numeric(10, 2), default=0)
    # 👇 NUEVO CAMPO PARA EL COSTO 👇
    precio_unitario = Column(Numeric(10, 2), default=0.0)

class EstructuraProducto(Base):
    __tablename__ = "estructura_producto"

    id_estructura = Column(Integer, primary_key=True, index=True)
    id_producto = Column(Integer, ForeignKey("productos.id_producto", ondelete="CASCADE"))
    id_material = Column(Integer, ForeignKey("materiales.id_material", ondelete="CASCADE"))
    cantidad_requerida = Column(Numeric(10, 2), nullable=False)

class Pedido(Base):
    __tablename__ = "pedidos"

    id_pedido = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(String(20), ForeignKey("clientes.id_cliente", ondelete="RESTRICT"))
    fecha_solicitud = Column(Date, default=date.today)
    
    # 👇 NUEVA COLUMNA PARA GUARDAR LA FECHA QUE VIENE DE ANGULAR 👇
    fecha_entrega = Column(Date, nullable=True) 
    
    estado = Column(String(50), default='PENDIENTE')
class DetallePedido(Base):
    __tablename__ = "detalles_pedido"

    id_detalle = Column(Integer, primary_key=True, index=True)
    id_pedido = Column(Integer, ForeignKey("pedidos.id_pedido", ondelete="CASCADE"))
    id_producto = Column(Integer, ForeignKey("productos.id_producto", ondelete="RESTRICT"))
    cantidad = Column(Integer, nullable=False)

# ... (Mantén lo anterior) ...

class Proveedor(Base):
    __tablename__ = "proveedores"

    id_proveedor = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    
    # 👇 NUEVO: Conecta el proveedor con sus precios automáticamente
    precios = relationship("PrecioProveedor", backref="proveedor", cascade="all, delete-orphan")

class PrecioProveedor(Base):
    __tablename__ = "precios_proveedor"

    id_precio = Column(Integer, primary_key=True, index=True)
    id_material = Column(Integer, ForeignKey("materiales.id_material", ondelete="CASCADE"))
    id_proveedor = Column(Integer, ForeignKey("proveedores.id_proveedor", ondelete="CASCADE"))
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    descuento_porcentaje = Column(Numeric(5, 2), default=0)

class OrdenCompra(Base):
    __tablename__ = "ordenes_compra"

    id_orden_compra = Column(Integer, primary_key=True, index=True)
    id_proveedor = Column(Integer, ForeignKey("proveedores.id_proveedor", ondelete="RESTRICT"))
    fecha_creacion = Column(Date, default=date.today)
    estado = Column(String(50), default='BORRADOR') # BORRADOR, ENVIADO, RECIBIDO

class DetalleOrdenCompra(Base):
    __tablename__ = "detalles_orden_compra"

    id_detalle_compra = Column(Integer, primary_key=True, index=True)
    id_orden_compra = Column(Integer, ForeignKey("ordenes_compra.id_orden_compra", ondelete="CASCADE"))
    id_material = Column(Integer, ForeignKey("materiales.id_material", ondelete="RESTRICT"))
    cantidad = Column(Numeric(10, 2), nullable=False)
    precio_unitario_acordado = Column(Numeric(10, 2), nullable=False)

# ... (Mantén lo anterior) ...

class OrdenTrabajo(Base):
    __tablename__ = "ordenes_trabajo"

    id_orden_trabajo = Column(Integer, primary_key=True, index=True)
    id_detalle_pedido = Column(Integer, ForeignKey("detalles_pedido.id_detalle", ondelete="CASCADE"))
    id_usuario = Column(String(20), ForeignKey("usuarios.id_usuario", ondelete="RESTRICT"))
    fecha_inicio = Column(Date, nullable=False)
    fecha_entrega_programada = Column(Date, nullable=False)
    fecha_entrega_real = Column(Date, nullable=True)
    estado = Column(String(50), default='ASIGNADO') # ASIGNADO, EN_PROGRESO, COMPLETADO

class Reunion(Base):
    __tablename__ = "reuniones"

    id_reunion = Column(Integer, primary_key=True, index=True)
    motivo = Column(String(200), nullable=False)
    fecha = Column(Date, nullable=False)
    hora = Column(Time, nullable=False)
    participantes = Column(Text, nullable=False)
    estado = Column(String(50), default="PROGRAMADA")
    detalle = Column(Text, nullable=True)
    
    # 👇 NUEVA COLUMNA JSON 👇
    tareas = Column(JSON, default=[])

class Mantenimiento(Base):
    __tablename__ = "mantenimientos"

    id_mantenimiento = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(String(20), ForeignKey("clientes.id_cliente"))
    id_producto = Column(Integer, ForeignKey("productos.id_producto"))
    fecha_mantenimiento = Column(Date, nullable=False)
    descripcion = Column(String(500))
    estado = Column(String(50), default="Programado") # Programado, Completado, Cancelado