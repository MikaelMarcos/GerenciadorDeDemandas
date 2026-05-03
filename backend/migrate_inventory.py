from database import engine
from models import InventoryItem, InventoryMovement

def upgrade():
    InventoryItem.__table__.create(engine, checkfirst=True)
    InventoryMovement.__table__.create(engine, checkfirst=True)
    print("Tabelas de inventário criadas com sucesso.")

if __name__ == "__main__":
    upgrade()
