import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, PlusCircle, Network, FileDown, Users as UsersIcon, LogOut, User as UserIcon, BrainCircuit, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getIconComponent } from '../utils/icons';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const CurrentUserIcon = getIconComponent(user?.icon);

  const menuItems = [
    { path: '/', name: 'Painel NUIAM', icon: LayoutDashboard },
    { path: '/assets', name: 'Árvore de Ativos', icon: Network },
    { path: '/inventory', name: 'Estoque', icon: Package },
    { path: '/service', name: 'Registrar Vistoria', icon: PlusCircle },
    { path: '/reports', name: 'Exportar Relatórios', icon: FileDown },
  ];

  if (user?.role === 'chefe' || user?.role === 'desenvolvedor') {
    menuItems.push({ path: '/users', name: 'Gestão de Usuários', icon: UsersIcon });
    menuItems.push({ path: '/ml-data', name: 'Dataset / IA', icon: BrainCircuit });
  }

  // Todos tem acesso ao perfil
  menuItems.push({ path: '/profile', name: 'Meu Perfil', icon: UserIcon });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out z-30 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between h-16 px-4 bg-slate-950">
          <span className="text-xl font-bold text-primary-500 tracking-wider">NUIAM</span>
          <button onClick={closeSidebar} className="md:hidden text-slate-300 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 shadow-sm z-10 w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-slate-600 hover:text-slate-900"
            >
              <Menu size={24} />
            </button>
            <h2 className="font-semibold text-slate-700 hidden sm:block">Painel Operacional</h2>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="text-sm font-medium text-slate-500 hidden sm:block text-right">
                 {user?.full_name} <br/> <span className="text-xs px-2 py-0.5 bg-slate-200 rounded text-slate-600">{user?.role}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 border border-primary-200 shadow-sm">
                <CurrentUserIcon size={20} />
              </div>
            </Link>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors ml-2" title="Sair">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
