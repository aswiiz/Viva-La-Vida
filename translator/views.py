from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

MIN_PASSWORD_LENGTH = 6


def _safe_next(request, fallback):
    """Return the ?next= target when it is safe, otherwise the fallback URL."""
    target = request.POST.get('next') or request.GET.get('next')
    if target and url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        return target
    return fallback


def home(request):
    """Translator homepage.

    Authenticated users and guests see the full workspace (camera demo access
    screen). Everyone else is redirected to Sign In, which is the website's
    initial page for non-authenticated visitors.
    """
    is_authenticated = request.user.is_authenticated
    is_guest = bool(request.session.get('is_guest', False))

    if not is_authenticated and not is_guest:
        # Redirect to the auth page for the initial page load.
        redirect_to = request.GET.get('next') or reverse('translator:signin')
        return redirect(_safe_next(request, redirect_to))

    return render(
        request,
        'translator/home.html',
        {
            'is_guest': is_guest,
            'next': request.GET.get('next', ''),
        },
    )


def practice(request):
    """Practice area — placeholder scaffold connecting to the camera."""
    return render(request, 'translator/practice.html', {'next': request.GET.get('next', '')})


def dictionary(request):
    """Dictionary area — placeholder scaffold for the sign list."""
    return render(request, 'translator/dictionary.html', {'next': request.GET.get('next', '')})


def profile(request):
    """Profile area — shows the signed-in account."""
    return render(
        request,
        'translator/profile.html',
        {'next': request.GET.get('next', ''), 'username': request.user.username},
    )


def signup(request):
    """Create an account and sign the new user in."""
    if request.user.is_authenticated:
        return redirect('translator:home')

    errors = {}
    username = ''

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        confirm = request.POST.get('confirm_password', '')

        if not username:
            errors['username'] = 'Please enter a username.'
        elif len(username) > 150:
            errors['username'] = 'Username must be 150 characters or fewer.'
        elif User.objects.filter(username__iexact=username).exists():
            errors['username'] = 'That username is already taken.'

        if not password:
            errors['password'] = 'Please enter a password.'
        elif len(password) < MIN_PASSWORD_LENGTH:
            errors['password'] = f'Password must be at least {MIN_PASSWORD_LENGTH} characters.'
        else:
            try:
                validate_password(password, user=User(username=username))
            except ValidationError as exc:
                errors['password'] = ' '.join(exc.messages)

        if not confirm:
            errors['confirm_password'] = 'Please confirm your password.'
        elif confirm != password:
            errors['confirm_password'] = 'Passwords do not match.'

        if not errors:
            user = User.objects.create_user(username=username, password=password)
            login(request, user)
            request.session['is_guest'] = False
            messages.success(request, f'Welcome, {user.username}! Your account is ready.')
            return redirect(_safe_next(request, reverse('translator:home')))

    return render(
        request,
        'translator/signup.html',
        {
            'auth_page': 'signup',
            'errors': errors,
            'username': username,
            'next': _safe_next(request, ''),
        },
        status=400 if errors else 200,
    )


def signin(request):
    """Authenticate an existing account."""
    if request.user.is_authenticated:
        return redirect('translator:home')

    errors = {}
    username = ''

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if not username:
            errors['username'] = 'Please enter your username.'
        if not password:
            errors['password'] = 'Please enter your password.'

        if not errors:
            user = authenticate(request, username=username, password=password)
            if user is None:
                errors['form'] = 'Incorrect username or password. Please try again.'
            else:
                login(request, user)
                request.session['is_guest'] = False
                messages.success(request, f'Welcome back, {user.username}!')
                return redirect(_safe_next(request, reverse('translator:home')))

    return render(
        request,
        'translator/signin.html',
        {
            'auth_page': 'signin',
            'errors': errors,
            'username': username,
            'next': _safe_next(request, ''),
        },
        status=400 if errors else 200,
    )


@require_POST
def continue_as_guest(request):
    """Skip authentication and open the translator as a guest."""
    if request.user.is_authenticated:
        logout(request)
    request.session['is_guest'] = True
    messages.success(request, 'You are browsing as a guest.')
    return redirect(_safe_next(request, reverse('translator:home')))


@require_POST
def logout_view(request):
    logout(request)
    messages.success(request, 'You have been signed out.')
    return HttpResponseRedirect(reverse('translator:signin'))
