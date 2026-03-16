import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Cargar las variables del archivo .env
load_dotenv()

# Obtener la URL de la base de datos
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Crear el "Motor" de la base de datos
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Crear la clase SessionLocal para interactuar con la BD
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para crear los modelos
Base = declarative_base()

# Dependencia para obtener la sesión de la base de datos en cada petición
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()