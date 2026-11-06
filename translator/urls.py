from django.urls import path

from . import views

app_name = 'translator'

urlpatterns = [
    path('', views.home, name='home'),
    path('signin/', views.signin, name='signin'),
    path('signup/', views.signup, name='signup'),
    path('guest/', views.continue_as_guest, name='guest'),
    path('logout/', views.logout_view, name='logout'),
    path('practice/', views.practice, name='practice'),
    path('dictionary/', views.dictionary, name='dictionary'),
    path('profile/', views.profile, name='profile'),
]
