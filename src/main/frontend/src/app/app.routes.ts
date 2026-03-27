import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

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
    path: 'campaigns/plan',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-plan-wizard/campaign-plan-wizard.component').then(m => m.CampaignPlanWizardComponent)
  },
  {
    path: 'campaigns/plan/:planId',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-plan-wizard/campaign-plan-wizard.component').then(m => m.CampaignPlanWizardComponent)
  },
  {
    path: 'campaigns/plan/:planId/detail',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./components/campaigns/campaign-v2-detail/campaign-v2-detail.component').then(m => m.CampaignV2DetailComponent)
  },
  {
    path: 'campaigns/:id/edit',
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
  {
    path: 'setup',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/setup/setup.component').then(m => m.SetupComponent)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'client-briefings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/client-briefings/client-briefing-list.component').then(m => m.ClientBriefingListComponent)
  },
  { path: '**', redirectTo: '/dashboard' }
];
