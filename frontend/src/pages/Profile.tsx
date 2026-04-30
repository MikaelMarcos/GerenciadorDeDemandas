import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { useToast } from '../contexts/ToastContext';
import { Lock, User as UserIcon, ShieldCheck, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';
import { availableIcons, getIconComponent } from '../utils/icons';

export default function Profile() {
  const { user, login } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [iconLoading, setIconLoading] = useState(false);

  // Derive initial icon from user
  const CurrentUserIcon = getIconComponent(user?.icon);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As novas senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/users/${user?.id}/password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      addToast('Sua senha foi atualizada com sucesso!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Não foi possível alterar a sua senha. Verifique se a senha atual está correta.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Banner & Profile Info */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
        {/* Banner Graphic */}
        <div className="h-48 w-full bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-600 relative overflow-hidden">
           <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 rounded-full bg-white opacity-20 blur-3xl"></div>
           <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 rounded-full bg-white opacity-20 blur-2xl"></div>
           {/* Grid Pattern overlay */}
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMjBoMjBWMEgwem0xOSAxSDFWMWgxOHYxOHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')]"></div>
        </div>
        
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-20 relative z-10">
            {/* Avatar Circle */}
            <div className="w-36 h-36 rounded-full bg-white border-[6px] border-white flex items-center justify-center text-primary-600 shadow-xl relative">
              <CurrentUserIcon size={64} className="drop-shadow-sm" />
              {user?.is_approved && (
                <div className="absolute bottom-2 right-2 bg-green-500 text-white rounded-full p-1.5 border-4 border-white shadow-sm" title="Usuário Aprovado">
                  <CheckCircle2 size={20} strokeWidth={3} />
                </div>
              )}
            </div>
            
            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{user?.full_name}</h1>
              <p className="text-slate-500 font-medium mt-1">@{user?.username}</p>
            </div>
            
            <div className="flex flex-wrap gap-3 pb-2">
               <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                 <UserIcon size={18} />
                 {user?.role}
               </span>
               <span className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold border shadow-sm ${user?.is_approved ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                 <ShieldCheck size={18} />
                 {user?.is_approved ? 'Acesso Liberado' : 'Aguardando Aprovação'}
               </span>
            </div>
          </div>
        </div>
      </div>

      {/* Forms & Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Change Password Form */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shadow-inner">
                 <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Segurança</h2>
                <p className="text-xs text-slate-500 font-medium">Altere sua senha de acesso</p>
              </div>
            </div>
            
            <div className="p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-3">
                  <div className="w-1.5 h-full rounded-full bg-red-500"></div>
                  {error}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Senha Atual</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full mt-4 inline-flex justify-center items-center gap-2 py-3.5 px-4 shadow-md text-sm font-bold rounded-xl text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-all transform active:scale-[0.98]"
                >
                  <KeyRound size={18} />
                  {loading ? 'Salvando...' : 'Atualizar Senha'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Change Icon Grid */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-inner">
                 <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Personalizar Avatar</h2>
                <p className="text-xs text-slate-500 font-medium">Como você será visto no sistema</p>
              </div>
            </div>
            
            <div className="p-8">
              <div className={`grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-5 ${iconLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                 {availableIcons.map(iconObj => {
                   const isSelected = user?.icon === iconObj.name;
                   const IconNode = iconObj.component;
                   return (
                     <button 
                       key={iconObj.name}
                       onClick={async () => {
                          if (!user || user.icon === iconObj.name) return;
                          setIconLoading(true);
                          try {
                             const updatedUser = { ...user, icon: iconObj.name };
                             await api.put(`/users/${user.id}/icon`, { icon: iconObj.name });
                             addToast(`Avatar atualizado para ${iconObj.name}!`, 'success');
                             
                             const isPersistent = !!localStorage.getItem('nuiam_user');
                             login(updatedUser, isPersistent);
                          } catch (e) {
                             addToast('Erro ao atualizar avatar.', 'error');
                          } finally {
                             setIconLoading(false);
                          }
                       }}
                       className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 ${
                         isSelected 
                         ? 'bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg shadow-primary-500/30 scale-110 ring-4 ring-primary-50' 
                         : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white hover:text-primary-600 hover:shadow-md hover:border-primary-100 hover:-translate-y-1'
                       }`}
                       title={iconObj.name}
                     >
                       <IconNode size={32} strokeWidth={isSelected ? 2.5 : 2} />
                     </button>
                   );
                 })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
