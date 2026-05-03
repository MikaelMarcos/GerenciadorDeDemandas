from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float, Boolean, Text, Table
from sqlalchemy.orm import relationship
from database import Base
import datetime

service_users = Table('service_users', Base.metadata,
    Column('service_id', Integer, ForeignKey('services.id')),
    Column('user_id', Integer, ForeignKey('users.id'))
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # chefe, técnico, estagiário, usuário externo
    is_approved = Column(Boolean, default=False)
    icon = Column(String, default="User")
    
    services = relationship("Service", secondary=service_users, back_populates="users")

class City(Base):
    __tablename__ = "cities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    systems = relationship("System", back_populates="city")

class System(Base):
    __tablename__ = "systems"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"))

    city = relationship("City", back_populates="systems")
    assets = relationship("Asset", back_populates="system")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String, index=True)
    category = Column(String) # Poço, Elevatória, Reservatório, Válvula, Captação
    system_id = Column(Integer, ForeignKey("systems.id"))
    last_maintenance = Column(Date, default=datetime.date.today)
    
    # ML Preparation fields
    humidity = Column(Float, nullable=True)
    interference = Column(Boolean, default=False)
    failure_reported = Column(Boolean, default=False)
    preventive_requested = Column(Boolean, default=False)
    kanban_status = Column(String, default="backlog") # backlog, todo, in_progress, done
    
    # Dashboard Priority Score
    priority_score = Column(Integer, default=0)

    system = relationship("System", back_populates="assets")
    services = relationship("Service", back_populates="asset")

class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    macro_type = Column(String) # Preventiva, Corretiva
    category = Column(String) # Macromedição, Telemetria, Inversor, Outros
    date = Column(Date, default=datetime.date.today)
    
    # Checklist
    is_closed_system = Column(Boolean, nullable=True)
    piping_material = Column(String, nullable=True) # PVC, Ferro
    diameter_mm = Column(Float, nullable=True)
    natural_influences = Column(String, nullable=True)
    electrical_interferences = Column(Boolean, nullable=True)
    materials_used = Column(Text, nullable=True)
    replaced_parts = Column(Text, nullable=True)

    asset = relationship("Asset", back_populates="services")
    users = relationship("User", secondary=service_users, back_populates="services")

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    current_quantity = Column(Float, default=0)
    unit = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    serial_number = Column(String, nullable=True)
    asset_tag = Column(String, nullable=True)
    model = Column(String, nullable=True)
    observations = Column(Text, nullable=True)
    min_stock_limit = Column(Float, default=2) # Pode ser quebrado se unidade for metros

    movements = relationship("InventoryMovement", back_populates="item")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"))
    movement_type = Column(String) # "in" or "out"
    quantity = Column(Float)
    responsible_name = Column(String)
    date = Column(Date, default=datetime.date.today)
    observation = Column(Text, nullable=True)

    item = relationship("InventoryItem", back_populates="movements")
