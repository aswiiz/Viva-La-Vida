from django.contrib.auth.views import LogoutView
from django.urls import path

from . import views

urlpatterns = [
    path("ping/", views.ping, name="ping"),
    path("", views.home, name="home"),
    path("practice/", views.practice, name="practice"),
    path("dictionary/", views.dictionary, name="dictionary"),
    path("collect/", views.collect, name="collect"),
    path("account/", views.account, name="account"),
    path("account/password/", views.ChangePassword.as_view(), name="password_change"),
    path("login/", views.SignInView.as_view(), name="login"),
    path("signup/", views.signup, name="signup"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("api/progress/", views.api_progress, name="api_progress"),
]
