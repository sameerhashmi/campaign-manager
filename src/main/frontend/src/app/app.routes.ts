import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'campaigns',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-list/campaign-list.component').then(m => m.CampaignListComponent)
  },
  {
    path: 'campaigns/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-form/campaign-form.component').then(m => m.CampaignFormComponent)
  },
  {
    path: 'campaigns/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-detail/campaign-detail.component').then(m => m.CampaignDetailComponent)
  },
  {
    path: 'contacts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/contacts/contact-list/contact-list.component').then(m => m.ContactListComponent)
  },
  { path: '**', redirectTo: '/dashboard' }
];
