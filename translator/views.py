import json

from django.contrib import messages
from django.contrib.auth import login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, PasswordChangeView
from django.contrib.messages.views import SuccessMessageMixin
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_http_methods, require_POST

from .forms import LoginForm, SignupForm
from .models import LearnedSign
from .signs import SIGN_IDS


def _learned(user):
    return list(LearnedSign.objects.filter(user=user).values_list("sign_id", flat=True)) if user.is_authenticated else []


def ping(request):
    """Lightweight keep-alive ping endpoint to prevent web service from sleeping on Render."""
    return JsonResponse({"status": "ok", "message": "pong"})


class SignInView(LoginView):
    template_name = "translator/login.html"
    authentication_form = LoginForm
    redirect_authenticated_user = True


def signup(request):
    if request.user.is_authenticated:
        return redirect("home")
    form = SignupForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        auth_login(request, user)
        messages.success(request, "Account created. Welcome!")
        return redirect("home")
    return render(request, "translator/signup.html", {"form": form})


@login_required
def home(request):
    """Home live translation page: requires authentication; unauthenticated visits redirect to /login/."""
    return render(request, "translator/home.html")


@login_required
def practice(request):
    """Practice page: requires authentication."""
    return render(request, "translator/practice.html", {"learned": _learned(request.user)})


def collect(request):
    """Hidden page (not in the menu) for recording real landmark samples to retrain the model."""
    return render(request, "translator/collect.html")


@login_required
def dictionary(request):
    """Dictionary page: requires authentication."""
    return render(request, "translator/dictionary.html")


@login_required
def account(request):
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "name":
            request.user.first_name = request.POST.get("name", "").strip()[:30]
            request.user.save(update_fields=["first_name"])
            messages.success(request, "Name saved.")
        elif action == "reset":
            LearnedSign.objects.filter(user=request.user).delete()
            messages.success(request, "Progress reset.")
        return redirect("account")
    learned = _learned(request.user)
    return render(request, "translator/account.html", {"learned": learned, "learned_count": len(learned), "sign_count": len(SIGN_IDS)})


class ChangePassword(SuccessMessageMixin, PasswordChangeView):
    template_name = "translator/password_change.html"
    success_url = reverse_lazy("account")
    success_message = "Password changed."


@require_http_methods(["GET", "POST"])
def api_progress(request):
    """Learning progress only (sign ids). No camera frames or landmarks are ever accepted."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "login required"}, status=401)
    if request.method == "POST":
        try:
            sign_id = json.loads(request.body or b"{}").get("sign_id")
        except (ValueError, AttributeError):
            return JsonResponse({"error": "bad json"}, status=400)
        if sign_id not in SIGN_IDS:
            return JsonResponse({"error": "unknown sign"}, status=400)
        obj, _ = LearnedSign.objects.get_or_create(user=request.user, sign_id=sign_id)
        LearnedSign.objects.filter(pk=obj.pk).update(correct_count=F("correct_count") + 1)
    return JsonResponse({"learned": _learned(request.user)})
