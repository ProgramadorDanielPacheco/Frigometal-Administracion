from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <-- NUEVO
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from fastapi import HTTPException, status
from datetime import date
from fastapi import UploadFile, File
import pandas as pd
import io

import models
import schemas
from database import engine, get_db
from passlib.context import CryptContext

# Configuramos el encriptador de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 2. Esquema temporal solo para recibir los datos del login
class LoginRequest(BaseModel):
    correo: str
    password: str

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Frigometal ERP API", version="1.0")

# ==========================================
# CONFIGURACIÓN CORS (PERMITE AL FRONTEND CONECTARSE)
# ==========================================


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # El puerto por defecto de Angular
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE
    allow_headers=["*"],
)


def get_password_hash(password):
    return pwd_context.hash(password)

@app.post("/login/", response_model=schemas.UsuarioResponse)
def iniciar_sesion(credenciales: LoginRequest, db: Session = Depends(get_db)):
    
    # Buscamos al usuario por su correo
    usuario = db.query(models.Usuario).filter(models.Usuario.correo == credenciales.correo).first()
    
    # Si no existe el correo, o si la contraseña no coincide (lanzamos el mismo error por seguridad para no dar pistas a los hackers)
    if not usuario or not verify_password(credenciales.password, usuario.hashed_password):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
        
    # Verificamos si el dueño no lo ha despedido/desactivado
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo. Contacta al administrador.")
        
    # Si todo está bien, devolvemos sus datos (sin la contraseña, gracias a tu UsuarioResponse)
    return usuario

@app.get("/")
def read_root():
    return {"mensaje": "¡Bienvenido a la API del ERP de Frigometal!"}

# ==========================================
# RUTAS PARA USUARIOS (TRABAJADORES/ADMIN)
# ==========================================

@app.post("/usuarios/", response_model=schemas.UsuarioResponse)
def crear_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    
    # 1. Validar que la cédula sea correcta matemáticamente (Algoritmo Módulo 10)
    # (Asegúrate de tener importada tu función validar_identificacion_ec)
    if not validar_identificacion_ec(usuario.id_usuario):
        raise HTTPException(status_code=400, detail="La cédula ingresada no es válida")

    # 2. Verificar si la cédula ya está registrada (evita duplicados exactos)
    db_cedula = db.query(models.Usuario).filter(models.Usuario.id_usuario == usuario.id_usuario).first()
    if db_cedula:
        raise HTTPException(status_code=400, detail="Esta cédula ya está registrada en el sistema")

    # 3. Verificar si el correo ya existe
    db_correo = db.query(models.Usuario).filter(models.Usuario.correo == usuario.correo).first()
    if db_correo:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    # 4. Encriptar la contraseña
    contra_encriptada = get_password_hash(usuario.password)
    
    # 5. Preparar el nuevo usuario asignando la cédula directamente
    nuevo_usuario = models.Usuario(
        id_usuario=usuario.id_usuario, # 👈 AHORA LE PASAMOS LA CÉDULA MANUALMENTE AQUÍ
        nombre=usuario.nombre,
        correo=usuario.correo,
        rol=usuario.rol,
        horas_maximas_semanales=usuario.horas_maximas_semanales,
        activo=usuario.activo,
        hashed_password=contra_encriptada # Guardamos la versión segura
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.get("/usuarios/", response_model=List[schemas.UsuarioResponse])
def obtener_usuarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    usuarios = db.query(models.Usuario).offset(skip).limit(limit).all()
    return usuarios



@app.put("/usuarios/{id_usuario}")
def actualizar_cliente(id_usuario: str, datos: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    usuario = db.query(models.Cliente).filter(models.Cliente.id_cliente == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Este ciclo actualiza automáticamente todos los campos del modelo
    for key, value in datos.model_dump().items():
        setattr(usuario, key, value)
    
    db.commit()
    return {"mensaje": "Datos actualizados correctamente"}
# ==========================================
# IMPORTACIÓN MASIVA DE USUARIOS (EXCEL)
# ==========================================
@app.post("/usuarios/importar/")
async def importar_usuarios_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Llenamos los espacios vacíos con valores por defecto seguros
        df = df.fillna({
            'cedula': '',
            'nombre': '', 
            'correo': '', 
            'rol': 'TRABAJADOR', 
            'horas_maximas_semanales': 40.0
        })

        usuarios_creados = 0
        errores = []

        for index, row in df.iterrows():
            # 1. Limpieza de datos
            cedula = str(row.get('cedula', '')).strip()
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
                
            nombre_user = str(row.get('nombre', '')).strip()
            correo_user = str(row.get('correo', '')).strip()
            rol_user = str(row.get('rol', 'TRABAJADOR')).strip().upper()
            
            # 2. Validar campos obligatorios
            if not cedula or not nombre_user or not correo_user:
                errores.append(f"Fila {index + 2}: Faltan datos (Cédula, Nombre o Correo).")
                continue

            # 3. Validar Cédula Ecuatoriana (Módulo 10)
            if not validar_identificacion_ec(cedula):
                errores.append(f"Fila {index + 2}: La cédula {cedula} es matemáticamente inválida.")
                continue

            try:
                horas_max = float(row.get('horas_maximas_semanales', 40.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error numérico en las horas de '{nombre_user}'.")
                continue

            # 4. Evitar duplicados de Cédula
            existe_cedula = db.query(models.Usuario).filter(models.Usuario.id_usuario == cedula).first()
            if existe_cedula:
                errores.append(f"Fila {index + 2}: La cédula {cedula} ya está registrada.")
                continue

            # 5. Evitar duplicados de Correo
            existe_correo = db.query(models.Usuario).filter(models.Usuario.correo == correo_user).first()
            if existe_correo:
                errores.append(f"Fila {index + 2}: El correo {correo_user} ya está en uso.")
                continue

            # 6. MAGIA: Usamos la cédula como contraseña temporal y la encriptamos
            contra_encriptada = get_password_hash(cedula)

            # 7. Crear el usuario
            nuevo_usuario = models.Usuario(
                id_usuario=cedula, # Asignación manual del ID (Cédula)
                nombre=nombre_user,
                correo=correo_user,
                rol=rol_user,
                horas_maximas_semanales=horas_max,
                activo=True,
                hashed_password=contra_encriptada # Contraseña segura
            )
            db.add(nuevo_usuario)
            usuarios_creados += 1

        # Confirmamos la transacción completa
        db.commit()
        
        return {
            "mensaje": f"Personal importado exitosamente: {usuarios_creados} usuarios nuevos.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")
# ==========================================
# RUTAS PARA CLIENTES
# ==========================================

def validar_identificacion_ec(identificacion: str) -> bool:
    if not identificacion or not identificacion.isdigit() or len(identificacion) not in [10, 13]:
        return False
    
    provincia = int(identificacion[0:2])
    # Provincias de Ecuador van del 01 al 24 (y 30 para ecuatorianos en el exterior)
    if provincia < 1 or (provincia > 24 and provincia != 30):
        return False
        
    tercer_digito = int(identificacion[2])

    # 1. Validación para Personas Naturales (Cédula o RUC que termina en 001)
    if tercer_digito < 6:
        if len(identificacion) == 13 and identificacion[10:13] != "001":
            return False
        
        # Algoritmo Módulo 10 del Registro Civil
        suma = 0
        for i in range(9):
            valor = int(identificacion[i])
            if i % 2 == 0:  # Posiciones impares (índices pares) se multiplican por 2
                valor *= 2
                if valor > 9:
                    valor -= 9
            suma += valor
            
        digito_verificador = int(identificacion[9])
        calculado = (10 - (suma % 10)) % 10
        return calculado == digito_verificador

    # 2. Validación estructural para Sociedades Privadas (Tercer dígito = 9, termina en 001)
    elif tercer_digito == 9:
        if len(identificacion) != 13 or identificacion[10:13] != "001":
            return False
        return True # (Aquí se podría agregar el Módulo 11 si se desea más precisión)

    # 3. Validación estructural para Entidades Públicas (Tercer dígito = 6, termina en 0001)
    elif tercer_digito == 6:
        if len(identificacion) != 13 or identificacion[9:13] != "0001":
            return False
        return True

    return False

# ==========================================
# ENDPOINT ACTUALIZADO DE CLIENTES
# ==========================================
@app.post("/clientes/", response_model=schemas.ClienteResponse)
def crear_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    
    # 1. Llamamos a nuestra validación antes de tocar la base de datos
    if not validar_identificacion_ec(cliente.id_cliente):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="La Cédula o RUC ingresado no es válido en Ecuador."
        )
    
    # 2. Verificamos que no exista ya en la base de datos
    cliente_existente = db.query(models.Cliente).filter(models.Cliente.id_cliente == cliente.id_cliente).first()
    if cliente_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Este cliente ya está registrado en el sistema."
        )

    # 3. Guardamos si todo está perfecto
    nuevo_cliente = models.Cliente(**cliente.model_dump())
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente

@app.get("/clientes/", response_model=List[schemas.ClienteResponse])
def obtener_clientes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    clientes = db.query(models.Cliente).offset(skip).limit(limit).all()
    return clientes

@app.put("/clientes/{id_cliente}")
def actualizar_cliente(id_cliente: str, datos: schemas.ClienteCreate, db: Session = Depends(get_db)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id_cliente == id_cliente).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Este ciclo actualiza automáticamente todos los campos del modelo
    for key, value in datos.model_dump().items():
        setattr(cliente, key, value)
    
    db.commit()
    return {"mensaje": "Datos actualizados correctamente"}


# ==========================================
# IMPORTACIÓN MASIVA DE CLIENTES (EXCEL)
# ==========================================
@app.post("/clientes/importar/")
async def importar_clientes_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Verificar que sea un Excel
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser un formato Excel (.xlsx)")

    try:
        # 2. Leer el archivo directamente desde la memoria
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Llenar los espacios vacíos con texto en blanco para evitar errores 'NaN'
        df = df.fillna("")

        clientes_agregados = 0
        errores = []

        

        # 3. Recorrer fila por fila el Excel
        for index, row in df.iterrows():
            # Buscamos las columnas por su nombre exacto en el encabezado del Excel
            # Agregamos .strip() para limpiar espacios invisibles
            cedula = str(row.get('cedula_cliente', '')).strip()
            
            # (Truco: Si Excel lee la cédula como número, le pondrá ".0" al final. Aquí se lo quitamos)
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
            
            nombre = str(row.get('nombre', '')).strip()
            telefono = str(row.get('telefono', '')).strip()
            correo = str(row.get('correo', '')).strip()
            direccion = str(row.get('direccion', '')).strip()

            # Validar que no falten los datos obligatorios
            if not cedula or not nombre:
                errores.append(f"Fila {index + 2}: Cédula o Nombre vacíos.")
                continue

            # Usamos el validador estricto que creaste antes
            if not validar_identificacion_ec(cedula):
                errores.append(f"Fila {index + 2}: Cédula/RUC inválido ({cedula}).")
                continue

            # Verificamos si ya existe para no duplicar
            existe = db.query(models.Cliente).filter(models.Cliente.id_cliente == cedula).first()
            if existe:
                errores.append(f"Fila {index + 2}: El cliente {cedula} ya existe en el sistema.")
                continue

            # Si pasa todas las pruebas, preparamos al cliente para guardarlo
            nuevo_cliente = models.Cliente(
                id_cliente=cedula,
                nombre=nombre,
                telefono=telefono,
                correo=correo,
                direccion=direccion
            )
            db.add(nuevo_cliente)
            clientes_agregados += 1

        # 4. Guardamos todos los clientes exitosos de golpe
        db.commit()
        
        return {
            "mensaje": f"Importación exitosa: {clientes_agregados} clientes nuevos.",
            "errores": errores # Devolvemos un reporte de los que fallaron para que el dueño sepa
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")

# ==========================================
# RUTAS PARA PRODUCTOS
# ==========================================

@app.post("/productos/", response_model=schemas.ProductoResponse)
def crear_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db)):
    nuevo_producto = models.Producto(**producto.model_dump())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return nuevo_producto

@app.get("/productos/", response_model=List[schemas.ProductoResponse])
def obtener_productos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    productos = db.query(models.Producto).offset(skip).limit(limit).all()
    return productos
# Ejemplo para Materiales
@app.put("/productos/{id_producto}")
def actualizar_material(id_producto: int, datos: schemas.MaterialBase, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(models.Producto.id_producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    for key, value in datos.model_dump().items():
        setattr(producto, key, value)
    
    db.commit()
    return {"mensaje": "Producto Actualizado"}
# ==========================================
# IMPORTACIÓN MASIVA: PRODUCTOS + ESTRUCTURA (EXCEL)
# ==========================================
@app.post("/productos/importar-catalogo/")
async def importar_productos_estructura(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Limpiamos los vacíos
        df = df.fillna({
            'nombre_producto': '',
            'tiempo_fabricacion': 0.0,
            'id_material': 0,
            'cantidad_material': 0.0
        })

        productos_creados = 0
        materiales_enlazados = 0
        errores = []
        
        # Memoria temporal para agrupar los materiales de un mismo producto
        productos_cache = {}

        for index, row in df.iterrows():
            nombre_prod = str(row.get('nombre_producto', '')).strip()
            
            if not nombre_prod:
                continue # Saltamos filas en blanco

            try:
                tiempo_fab = float(row.get('tiempo_fabricacion', 0.0))
                id_mat = int(row.get('id_material', 0))
                cantidad_mat = float(row.get('cantidad_material', 0.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error numérico en tiempo, ID de material o cantidad.")
                continue

            # ==========================================
            # PASO 1: CREAR O IDENTIFICAR EL PRODUCTO
            # ==========================================
            if nombre_prod not in productos_cache:
                producto = db.query(models.Producto).filter(models.Producto.nombre == nombre_prod).first()
                
                if not producto:
                    # Si el producto no existe en la BD, lo creamos
                    producto = models.Producto(
                        nombre=nombre_prod,
                        tiempo_fabricacion_horas=tiempo_fab
                    )
                    db.add(producto)
                    db.flush() # Guardamos temporalmente para que Python le genere el ID
                    productos_creados += 1
                    
                # Guardamos el producto en caché para esta sesión
                productos_cache[nombre_prod] = producto

            producto_actual = productos_cache[nombre_prod]

            # ==========================================
            # PASO 2: AGREGAR A LA ESTRUCTURA DEL PRODUCTO
            # ==========================================
            if id_mat > 0 and cantidad_mat > 0:
                # Validar que el material exista en el inventario
                material_existe = db.query(models.Material).filter(models.Material.id_material == id_mat).first()
                
                if not material_existe:
                    errores.append(f"Fila {index + 2}: El material ID {id_mat} no existe en el inventario.")
                    continue
                
                # Revisamos si ya existe este material en la estructura de este producto
                ingrediente_existente = db.query(models.EstructuraProducto).filter(
                    models.EstructuraProducto.id_producto == producto_actual.id_producto,
                    models.EstructuraProducto.id_material == id_mat
                ).first()

                if not ingrediente_existente:
                    # 👇 USAMOS TU MODELO EXACTO AQUÍ 👇
                    nuevo_ingrediente = models.EstructuraProducto(
                        id_producto=producto_actual.id_producto,
                        id_material=id_mat,
                        cantidad_requerida=cantidad_mat # <-- Tu columna exacta
                    )
                    db.add(nuevo_ingrediente)
                    materiales_enlazados += 1

        # Confirmamos todo el lote
        db.commit()
        
        return {
            "mensaje": f"Catálogo actualizado: {productos_creados} productos nuevos y {materiales_enlazados} materiales añadidos a sus estructuras.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Cancelamos si el archivo explota
        raise HTTPException(status_code=500, detail=f"Error procesando el Excel: {str(e)}")

@app.post("/materiales/", response_model=schemas.MaterialResponse)
def crear_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    nuevo_material = models.Material(**material.model_dump())
    db.add(nuevo_material)
    db.commit()
    db.refresh(nuevo_material)
    return nuevo_material


# ==========================================
# IMPORTACIÓN MASIVA DE MATERIALES (EXCEL)
# ==========================================
@app.post("/materiales/importar/")
async def importar_materiales_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Limpiamos: llenamos los textos vacíos con "" y los números vacíos con 0
        df = df.fillna({
            'nombre': '', 
            'unidad_medida': 'Unidades', 
            'stock_actual': 0, 
            'stock_minimo_alerta': 0
        })

        materiales_agregados = 0
        errores = []

        for index, row in df.iterrows():
            # 1. Leer textos
            nombre_mat = str(row.get('nombre', '')).strip()
            unidad = str(row.get('unidad_medida', 'Unidades')).strip()
            
            if not nombre_mat:
                errores.append(f"Fila {index + 2}: El nombre del material está vacío.")
                continue

            # 2. Leer números (con protección por si en el Excel escribieron letras por error)
            try:
                stock = float(row.get('stock_actual', 0))
                stock_minimo = float(row.get('stock_minimo_alerta', 0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error en los números de stock del material '{nombre_mat}'.")
                continue

            # 3. Evitar duplicados (Buscamos si ya existe un material con ese nombre exacto)
            # ⚠️ Asegúrate de que 'models.Material' coincida con tu código real
            existe = db.query(models.Material).filter(models.Material.nombre == nombre_mat).first()
            if existe:
                # Si ya existe, podríamos sumarle el stock, pero por seguridad mejor avisamos
                errores.append(f"Fila {index + 2}: El material '{nombre_mat}' ya existe en el inventario.")
                continue

            # 4. Guardar en la base de datos
            nuevo_material = models.Material(
                nombre=nombre_mat,
                unidad_medida=unidad,
                stock_actual=stock,
                stock_minimo_alerta=stock_minimo
            )
            db.add(nuevo_material)
            materiales_agregados += 1

        db.commit()
        
        return {
            "mensaje": f"Inventario actualizado: {materiales_agregados} materiales nuevos importados.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")
    
# Ejemplo para Materiales
@app.put("/materiales/{id_material}")
def actualizar_material(id_material: int, datos: schemas.MaterialBase, db: Session = Depends(get_db)):
    material = db.query(models.Material).filter(models.Material.id_material == id_material).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    for key, value in datos.model_dump().items():
        setattr(material, key, value)
    
    db.commit()
    return {"mensaje": "Inventario actualizado"}

@app.post("/estructura-producto/")
def agregar_material_a_producto(estructura: schemas.EstructuraProductoCreate, db: Session = Depends(get_db)):
    nueva_estructura = models.EstructuraProducto(**estructura.model_dump())
    db.add(nueva_estructura)
    db.commit()
    return {"mensaje": "Material agregado a la receta del producto con éxito."}

@app.get("/estructura-producto/{id_producto}")
def obtener_receta_producto(id_producto: int, db: Session = Depends(get_db)):
    # Buscamos todos los materiales asignados a este producto en específico
    receta = db.query(models.EstructuraProducto).filter(models.EstructuraProducto.id_producto == id_producto).all()
    return receta

@app.delete("/estructura-producto/{id_estructura}")
def eliminar_material_receta(id_estructura: int, db: Session = Depends(get_db)):
    # Buscamos el registro específico que queremos borrar
    item = db.query(models.EstructuraProducto).filter(models.EstructuraProducto.id_estructura == id_estructura).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="El material no existe en esta receta")
        
    db.delete(item)
    db.commit()
    return {"mensaje": "Material eliminado de la receta con éxito."}

# ==========================================
# RUTAS PARA PEDIDOS Y DESCUENTO DE STOCK (LA MAGIA)
# ==========================================
@app.post("/pedidos/", response_model=schemas.PedidoResponse)
def crear_pedido(pedido: schemas.PedidoCreate, db: Session = Depends(get_db)):
    # 1. Creamos la cabecera del pedido (Estado por defecto: PENDIENTE)
    nuevo_pedido = models.Pedido(
        id_cliente=pedido.id_cliente, 
        fecha_entrega=pedido.fecha_entrega,
        estado="PENDIENTE" 
    )
    db.add(nuevo_pedido)
    db.flush() # Para obtener el ID del pedido

    # 2. Registramos los productos solicitados
    for detalle in pedido.detalles:
        nuevo_detalle = models.DetallePedido(
            id_pedido=nuevo_pedido.id_pedido,
            id_producto=detalle.id_producto,
            cantidad=detalle.cantidad
        )
        db.add(nuevo_detalle)

    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido

# ==========================================
# OBTENER EL HISTORIAL DE PEDIDOS (GET)
# ==========================================
@app.get("/pedidos/")
def obtener_pedidos(db: Session = Depends(get_db)):
    # 1. Traemos todos los pedidos básicos de la tabla principal
    pedidos = db.query(models.Pedido).all()
    
    resultado = []
    
    # 2. Recorremos cada pedido uno por uno
    for p in pedidos:
        # Buscamos los productos específicos de ESTE pedido en la tabla de detalles
        detalles = db.query(models.DetallePedido).filter(models.DetallePedido.id_pedido == p.id_pedido).all()
        
        # 3. Armamos un "paquete" con los datos del pedido + sus detalles
        pedido_empaquetado = {
            "id_pedido": p.id_pedido,
            "id_cliente": p.id_cliente,
            "fecha_entrega": p.fecha_entrega,
            # Usamos getattr por si tu tabla Pedido no tiene la columna 'estado'
            "estado": getattr(p, "estado", "Pendiente"), 
            "detalles": detalles # ¡Aquí incrustamos los productos y cantidades!
        }
        
        resultado.append(pedido_empaquetado)
        
    return resultado

class EstadoUpdate(BaseModel):
    estado: str

# Ejemplo para Clientes (Repite la misma lógica para Usuarios)




# ==========================================
# ACTUALIZAR ESTADO DEL PEDIDO (PATCH)
# ==========================================
@app.patch("/pedidos/{id_pedido}/estado")
def actualizar_estado_pedido(id_pedido: int, datos: schemas.EstadoUpdate, db: Session = Depends(get_db)):
    # 1. Buscar el pedido
    pedido = db.query(models.Pedido).filter(models.Pedido.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    nuevo_estado = datos.estado.upper()
    estado_anterior = pedido.estado.upper()

    # ==============================================================
    # LÓGICA DE PRODUCCIÓN: Descuento de Stock y Compras Inteligentes
    # ==============================================================
    if nuevo_estado == "EN PRODUCCIÓN" and estado_anterior == "PENDIENTE":
        for detalle in pedido.detalles:
            # Buscamos la receta del producto
            receta = db.query(models.EstructuraProducto).filter(
                models.EstructuraProducto.id_producto == detalle.id_producto
            ).all()

            for componente in receta:
                material = db.query(models.Material).filter(
                    models.Material.id_material == componente.id_material
                ).first()
                
                if material:
                    cantidad_a_restar = detalle.cantidad * componente.cantidad_requerida
                    
                    # Verificación de seguridad: ¿Hay suficiente material?
                    if material.stock_actual < cantidad_a_restar:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"No hay suficiente {material.nombre}. Stock: {material.stock_actual}, Necesario: {cantidad_a_restar}"
                        )

                    # Descontamos de la bodega
                    material.stock_actual -= cantidad_a_restar

                    # ----------------------------------------------------------
                    # PASO 4.5: ALERTA DE COMPRAS INTELIGENTE (Migrada)
                    # ----------------------------------------------------------
                    if material.stock_actual < material.stock_minimo_alerta:
                        # Buscar el proveedor más barato
                        mejor_precio = db.query(models.PrecioProveedor).filter(
                            models.PrecioProveedor.id_material == material.id_material
                        ).order_by(models.PrecioProveedor.precio_unitario.asc()).first()

                        if mejor_precio:
                            # Creamos la Orden de Compra en BORRADOR automáticamente
                            nueva_orden = models.OrdenCompra(
                                id_proveedor=mejor_precio.id_proveedor,
                                estado="BORRADOR"
                            )
                            db.add(nueva_orden)
                            db.flush()

                            cantidad_sugerida = material.stock_minimo_alerta - material.stock_actual + 20
                            
                            detalle_compra = models.DetalleOrdenCompra(
                                id_orden_compra=nueva_orden.id_orden_compra,
                                id_material=material.id_material,
                                cantidad=cantidad_sugerida,
                                precio_unitario_acordado=mejor_precio.precio_unitario
                            )
                            db.add(detalle_compra)
                    # ----------------------------------------------------------

    # 2. Actualizamos el estado del pedido (ya sea a Producción o a Entregado)
    pedido.estado = nuevo_estado
    db.commit()
    
    return {"mensaje": f"Estado actualizado a {nuevo_estado} y procesos de stock ejecutados."}

# ==========================================
# IMPORTACIÓN MASIVA DE PROVEEDORES (EXCEL)
# ==========================================
# ==========================================
# IMPORTACIÓN MASIVA: PROVEEDORES + PRECIOS (EXCEL)
# ==========================================
@app.post("/proveedores/importar-catalogo/")
async def importar_catalogo_proveedores(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        # Llenamos los textos vacíos con "" y los números vacíos con 0
        df = df.fillna({
            'nombre_proveedor': '', 
            'id_material': 0, 
            'precio_unitario': 0.0, 
            'descuento': 0.0
        })

        registros_exitosos = 0
        errores = []

        for index, row in df.iterrows():
            nombre_prov = str(row.get('nombre_proveedor', '')).strip()
            
            # Evitamos errores si en el Excel dejaron una fila en blanco
            if not nombre_prov:
                continue 
                
            # Extraemos los números de forma segura
            try:
                id_mat = int(row.get('id_material', 0))
                precio = float(row.get('precio_unitario', 0.0))
                desc = float(row.get('descuento', 0.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error en los números de precio, descuento o ID.")
                continue

            # PASO 1: BUSCAR O CREAR AL PROVEEDOR
            proveedor = db.query(models.Proveedor).filter(models.Proveedor.nombre == nombre_prov).first()
            if not proveedor:
                proveedor = models.Proveedor(nombre=nombre_prov)
                db.add(proveedor)
                db.flush() # Guardamos temporalmente para que Python le genere un ID nuevo

            # PASO 2: VERIFICAR QUE EL MATERIAL EXISTA (Si nos pasaron un ID de material)
            if id_mat > 0:
                # ⚠️ Asegúrate de que 'models.Material' y 'id_material' coincidan con tu código real
                material_existe = db.query(models.Material).filter(models.Material.id_material == id_mat).first()
                
                if not material_existe:
                    errores.append(f"Fila {index + 2}: El material con ID {id_mat} no existe en el inventario.")
                    continue

                # PASO 3: ASIGNAR EL PRECIO EN LA TABLA 'precios_proveedor'
                # Primero revisamos si ya le habíamos asignado un precio antes a ese material con este proveedor
                precio_existente = db.query(models.PrecioProveedor).filter(
                    models.PrecioProveedor.id_proveedor == proveedor.id_proveedor,
                    models.PrecioProveedor.id_material == id_mat
                ).first()

                if precio_existente:
                    # Si ya existía, le actualizamos el precio y el descuento
                    precio_existente.precio_unitario = precio
                    precio_existente.descuento_porcentaje = desc
                else:
                    # Si es nuevo, creamos el enlace en Compras Inteligentes
                    nuevo_precio = models.PrecioProveedor(
                        id_proveedor=proveedor.id_proveedor,
                        id_material=id_mat,
                        precio_unitario=precio,
                        descuento_porcentaje=desc
                    )
                    db.add(nuevo_precio)
            
            registros_exitosos += 1

        # Guardamos todo el lote de una sola vez
        db.commit()
        
        return {
            "mensaje": f"Catálogo importado: {registros_exitosos} precios/proveedores procesados.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Si algo explota, cancelamos todo para no dañar la base
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")

# ==========================================
# IMPORTACIÓN MASIVA DE PEDIDOS Y DETALLES (EXCEL)
# ==========================================
@app.post("/pedidos/importar/")
async def importar_pedidos_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.fillna("")

        # Diccionario para agrupar productos en un solo pedido si coinciden en cliente y fecha
        # Llave: (cedula, fecha) -> Valor: Objeto del Pedido recién creado
        pedidos_creados = {} 
        
        contadores = {"pedidos": 0, "productos": 0}
        errores = []

        for index, row in df.iterrows():
            # 1. Limpieza de datos (Evitar el .0 en la cédula si Excel lo leyó como número)
            cedula = str(row.get('cedula_cliente', '')).strip()
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
                
            # Extraemos los primeros 10 caracteres de la fecha (YYYY-MM-DD)
            fecha_str = str(row.get('fecha_entrega', ''))[:10].strip()
            
            try:
                id_prod = int(row.get('id_producto', 0))
                cantidad = int(row.get('cantidad', 0))
            except ValueError:
                errores.append(f"Fila {index + 2}: El ID del producto o la cantidad deben ser números.")
                continue

            # 2. Validaciones básicas
            if not cedula or not fecha_str or id_prod <= 0 or cantidad <= 0:
                errores.append(f"Fila {index + 2}: Faltan datos obligatorios (Cédula, Fecha, ID o Cantidad).")
                continue

            # 3. Validar que el cliente exista en la base de datos
            cliente = db.query(models.Cliente).filter(models.Cliente.id_cliente == cedula).first()
            if not cliente:
                errores.append(f"Fila {index + 2}: El cliente con cédula {cedula} no está registrado.")
                continue

            # 4. Validar que el producto exista en el catálogo
            producto = db.query(models.Producto).filter(models.Producto.id_producto == id_prod).first()
            if not producto:
                errores.append(f"Fila {index + 2}: El producto con ID {id_prod} no existe en el catálogo.")
                continue

            # ==========================================
            # MAGIA RELACIONAL: AGRUPAMIENTO
            # ==========================================
            clave_agrupacion = (cedula, fecha_str)

            # Si es la primera vez que vemos a este cliente con esta fecha, creamos el Pedido Padre
            if clave_agrupacion not in pedidos_creados:
                nuevo_pedido = models.Pedido(
                    id_cliente=cedula,
                    fecha_entrega=fecha_str,
                    estado="PENDIENTE" # Todo pedido masivo entra como pendiente
                )
                db.add(nuevo_pedido)
                db.flush() # Guardamos para que Python le asigne el ID de inmediato
                
                pedidos_creados[clave_agrupacion] = nuevo_pedido
                contadores["pedidos"] += 1

            # Recuperamos el Pedido Padre (ya sea el que acabamos de crear o uno de filas anteriores)
            pedido_actual = pedidos_creados[clave_agrupacion]

            # 5. Creamos el Detalle del Pedido (El producto que van a fabricar)
            nuevo_detalle = models.DetallePedido(
                id_pedido=pedido_actual.id_pedido,
                id_producto=id_prod,
                cantidad=cantidad
            )
            db.add(nuevo_detalle)
            contadores["productos"] += 1

        # Confirmamos la transacción completa
        db.commit()
        
        return {
            "mensaje": f"Se crearon {contadores['pedidos']} pedidos nuevos con un total de {contadores['productos']} productos a fabricar.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Si el Excel tiene un formato destructivo, abortamos todo para proteger la BD
        raise HTTPException(status_code=500, detail=f"Error crítico procesando el archivo: {str(e)}")

# ==========================================
# OBTENER LISTA DE PROVEEDORES (GET)
# ==========================================
@app.get("/proveedores/")
def obtener_proveedores(db: Session = Depends(get_db)):
    # Traemos todos los proveedores de la base de datos
    return db.query(models.Proveedor).all()

@app.post("/precios-proveedor/")
def agregar_precio_material(precio: schemas.PrecioProveedorCreate, db: Session = Depends(get_db)):
    nuevo_precio = models.PrecioProveedor(**precio.model_dump())
    db.add(nuevo_precio)
    db.commit()
    return {"mensaje": "Precio del proveedor registrado con éxito."}

@app.get("/ordenes-compra/", response_model=List[schemas.OrdenCompraResponse])
def ver_ordenes_de_compra(db: Session = Depends(get_db)):
    return db.query(models.OrdenCompra).all()

# ... (Mantén lo anterior) ...

# ==========================================
# RUTAS PARA PROGRAMACIÓN Y CONTROL DE HORAS
# ==========================================
@app.post("/ordenes-trabajo/", response_model=schemas.OrdenTrabajoResponse)
def asignar_trabajador(orden: schemas.OrdenTrabajoCreate, db: Session = Depends(get_db)):
    
    # 1. Obtener al trabajador para saber su límite de horas
    trabajador = db.query(models.Usuario).filter(models.Usuario.id_usuario == orden.id_usuario).first()
    if not trabajador:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # 2. Obtener el detalle del pedido y el producto para saber el tiempo de fabricación
    detalle = db.query(models.DetallePedido).filter(models.DetallePedido.id_detalle == orden.id_detalle_pedido).first()
    if not detalle:
        raise HTTPException(status_code=404, detail="El detalle del pedido no existe")
        
    producto = db.query(models.Producto).filter(models.Producto.id_producto == detalle.id_producto).first()
    
    # Horas que tomará hacer este pedido (Cantidad x Tiempo de 1 producto)
    horas_nueva_tarea = detalle.cantidad * producto.tiempo_fabricacion_horas

    # 3. Calcular las horas que el trabajador YA tiene ocupadas en otras tareas no terminadas
    ordenes_activas = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.id_usuario == trabajador.id_usuario,
        models.OrdenTrabajo.estado.in_(['ASIGNADO', 'EN_PROGRESO'])
    ).all()

    horas_actuales_ocupadas = 0
    for oa in ordenes_activas:
        det = db.query(models.DetallePedido).filter(models.DetallePedido.id_detalle == oa.id_detalle_pedido).first()
        prod = db.query(models.Producto).filter(models.Producto.id_producto == det.id_producto).first()
        horas_actuales_ocupadas += (det.cantidad * prod.tiempo_fabricacion_horas)

    # 4. VALIDACIÓN ESTRICTA: ¿Se pasa de su límite semanal?
    if (horas_actuales_ocupadas + horas_nueva_tarea) > trabajador.horas_maximas_semanales:
        raise HTTPException(
            status_code=400, 
            detail=f"ALERTA: Límite excedido. {trabajador.nombre} tiene {horas_actuales_ocupadas}h ocupadas. Límite: {trabajador.horas_maximas_semanales}h. Esta nueva tarea exige {horas_nueva_tarea}h."
        )

    # 5. Si no se excede el límite, se crea la orden de trabajo (La Programación)
    nueva_orden = models.OrdenTrabajo(**orden.model_dump())
    db.add(nueva_orden)
    db.commit()
    db.refresh(nueva_orden)
    
    return nueva_orden
@app.get("/ordenes-trabajo/", response_model=List[schemas.OrdenTrabajoResponse])
def obtener_programacion(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    ordenes = db.query(models.OrdenTrabajo).offset(skip).limit(limit).all()
    return ordenes

class EstadoOrdenUpdate(BaseModel):
    estado: str

# ==========================================
# ACTUALIZAR ESTADO DE LA ORDEN DE TRABAJO (PATCH)
# ==========================================
@app.patch("/ordenes-trabajo/{id_orden}/estado")
def actualizar_estado_orden(id_orden: int, datos: EstadoOrdenUpdate, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id_orden_trabajo == id_orden).first()
    
    if not orden:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
        
    # 1. Actualizamos el estado de texto
    orden.estado = datos.estado

    # 2. MAGIA ERP: Si lo completan, sellamos la fecha real de entrega.
    if datos.estado == 'COMPLETADO':
        orden.fecha_entrega_real = date.today()
    elif datos.estado in ['ASIGNADO', 'EN_PROGRESO']:
        # Por si el trabajador se equivocó y lo regresa a un estado anterior, borramos la fecha
        orden.fecha_entrega_real = None 

    db.commit()
    
    return {"mensaje": f"Orden actualizada a {datos.estado}"}

# ==========================================
# RUTAS PARA MATERIALES E INVENTARIO
# ==========================================

# (Este ya lo tenías, es para crear materiales)
@app.post("/materiales/", response_model=schemas.MaterialResponse)
def crear_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    nuevo_material = models.Material(**material.model_dump())
    db.add(nuevo_material)
    db.commit()
    db.refresh(nuevo_material)
    return nuevo_material

# 👇 ESTE ES EL CÓDIGO NUEVO QUE DEBES AGREGAR 👇
@app.get("/materiales/", response_model=List[schemas.MaterialResponse])
def obtener_materiales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    materiales = db.query(models.Material).offset(skip).limit(limit).all()
    return materiales
# 👆 HASTA AQUÍ 👆

# ==========================================
# RUTAS PARA EL DASHBOARD (KPIs)
# ==========================================
@app.get("/dashboard/resumen/")
def obtener_resumen_dashboard(db: Session = Depends(get_db)):
    # 1. Contar cuántos pedidos no están entregados
    pedidos_activos = db.query(models.Pedido).filter(models.Pedido.estado != 'ENTREGADO').count()
    
    # 2. Contar cuántos materiales están en alerta roja o amarilla
    alertas_inventario = db.query(models.Material).filter(models.Material.stock_actual <= models.Material.stock_minimo_alerta).count()
    
    # 3. Contar presupuestos en borrador
    compras_pendientes = db.query(models.OrdenCompra).filter(models.OrdenCompra.estado.in_(['BORRADOR']) ).count()
    
    # 4. Contar cuántas tareas están agendadas
    tareas_activas = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.estado.in_(['ASIGNADO', 'EN_PROGRESO'])).count()

    return {
        "pedidos_activos": pedidos_activos,
        "alertas_inventario": alertas_inventario,
        "compras_pendientes": compras_pendientes,
        "tareas_activas": tareas_activas
    }