from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.shortcuts import redirect, render
from django.urls import reverse
from django.http import (
    HttpResponseRedirect,
    JsonResponse,
    HttpResponseBadRequest,
)
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from django.utils import timezone
import json

from . import models as tmodels
from .recognition import (
    Recognizer,
    is_model_configured,
    recognize_landmarks,
)

MIN_PASSWORD_LENGTH = 6


def _safe_next(request, fallback):
    """Return the ?next= target when it is safe, otherwise the fallback URL."""
    target = request.POST.get('next') or request.GET.get('next')
    if target and url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        return target
    return fallback


# ---------------------------------------------------------------------------
# Frontend pages
# ---------------------------------------------------------------------------

def home(request):
    """Translator homepage."""
    is_authenticated = request.user.is_authenticated
    is_guest = bool(request.session.get('is_guest', False))

    if not is_authenticated and not is_guest:
        redirect_to = request.GET.get('next') or reverse('translator:signin')
        return redirect(_safe_next(request, redirect_to))

    # Preload a small greeting hint for guests; users see their own name.
    greeting = None
    if is_guest:
        greeting = "You are browsing as a guest — your session is saved on this device."

    return render(
        request,
        'translator/home.html',
        {
            'is_guest': is_guest,
            'next': request.GET.get('next', ''),
            'greeting': greeting,
        },
    )


def practice(request):
    """Practice area — the camera/recognition workspace is a client-side app."""
    return render(request, 'translator/practice.html', {'next': request.GET.get('next', '')})


def dictionary(request):
    """Dictionary page with search and filter by category/supported status."""
    return render(
        request,
        'translator/dictionary.html',
        {'next': request.GET.get('next', '')},
    )


def profile(request):
    """Profile page for the signed-in account."""
    if not request.user.is_authenticated:
        return redirect('translator:signin')
    return render(
        request,
        'translator/profile.html',
        {'next': request.GET.get('next', ''), 'username': request.user.username},
    )


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

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

    elif request.method == 'POST':
        # Redirect to signup if someone lands on the form with a POST but no body.
        pass

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


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

def profile_detail(request):
    """Display the signed-in user's profile and recognition history."""
    profile, _ = tmodels.UserProfile.objects.get_or_create(user=request.user)
    history = (
        request.user.recognition_history.select_related('gesture')
        .order_by('-created_at')[:50]
    )
    gestures = tmodels.Gesture.objects.filter(is_supported=True).order_by('category', 'name')
    context = {
        'next': request.GET.get('next', ''),
        'profile': profile,
        'history': history,
        'gestures': gestures,
    }
    return render(request, 'translator/profile.html', context)


def profile_update(request):
    """Handle profile preference updates (bio, accent color, auto-speak)."""
    if not request.user.is_authenticated:
        return HttpResponseBadRequest("Authentication required.")

    profile = request.user.profile
    if request.method == 'POST':
        bio = request.POST.get('bio', '').strip()
        accent_color = request.POST.get('accent_color', '').strip()
        auto_speak = request.POST.get('auto_speak') is not None
        auto_append = request.POST.get('auto_append') is not None

        if bio:
            if len(bio) > 280:
                return HttpResponseBadRequest("Bio must be 280 characters or fewer.")
            profile.bio = bio

        if accent_color:
            accent_color = accent_color.lower().lstrip('#')
            if len(accent_color) != 6 or not all(c in '0123456789abcdef' for c in accent_color):
                return HttpResponseBadRequest("Invalid accent colour (use #rrggbb).")
            profile.accent_color = '#' + accent_color

        profile.auto_speak = auto_speak
        profile.auto_append = auto_append
        profile.save()

    return redirect('translator:profile')


# ---------------------------------------------------------------------------
# Dictionary (server-side data)
# ---------------------------------------------------------------------------

def dictionary_list(request):
    """Return gestures as JSON for the client; handles search and category filter."""
    query = request.GET.get('q', '').strip()
    category = request.GET.get('category', '').strip()
    supported_only = request.GET.get('supported_only') == '1'

    gestures = tmodels.Gesture.objects.all()

    if query:
        gestures = gestures.filter(
            Q(name__icontains=query) |
            Q(meaning__icontains=query) |
            Q(description__icontains=query) |
            Q(example__icontains=query) |
            Q(slug__icontains=query)
        )
    if category:
        gestures = gestures.filter(category__iexact=category)
    if supported_only:
        gestures = gestures.filter(is_supported=True)

    gestures = gestures.order_by('category', 'name')

    data = []
    for g in gestures:
        data.append({
            'id': g.id,
            'slug': g.slug,
            'name': g.name,
            'meaning': g.meaning,
            'description': g.description,
            'example': g.example,
            'category': g.category,
            'is_supported': g.is_supported,
            'is_demo': g.is_demo,
            'recogniser_available': is_model_configured() and g.is_supported,
        })

    return JsonResponse({'gestures': data, 'count': len(data)})


# ---------------------------------------------------------------------------
# Recognition API
# ---------------------------------------------------------------------------

@require_POST
def recognize(request):
    """Receive normalized hand landmarks from the browser and return a sign.

    The browser runs MediaPipe locally for hand detection. Landmarks are sent as
    JSON to this endpoint, which delegates to the modular recogniser. No video
    is stored or forwarded — only a compact 63-d landmark vector.
    """
    if not request.user.is_authenticated and not request.session.get('is_guest'):
        return JsonResponse(
            {'error': 'Authentication required to use the recogniser.'},
            status=401,
        )

    try:
        payload = json.loads(request.body or '{}')
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

    landmarks = payload.get('landmarks')
    if not landmarks:
        return JsonResponse({'error': 'Missing "landmarks" field.'}, status=400)

    if not isinstance(landmarks, (list, dict)):
        return JsonResponse({'error': '"landmarks" must be an array or object.'}, status=400)

    # Validate the feature vector length (21 points x 3 coords = 63).
    if isinstance(landmarks, (list, tuple)):
        flat = []
        for item in landmarks:
            if isinstance(item, dict):
                flat.extend([item.get('x', 0.0), item.get('y', 0.0), item.get('z', 0.0)])
            else:
                flat.extend([float(v) for v in item[:3]])
        if len(flat) < 63:
            return JsonResponse({'error': 'Insufficient landmark coordinates.'}, status=400)
    else:
        if len(payload) < 63:
            return JsonResponse({'error': 'Insufficient landmark coordinates.'}, status=400)

    # Delegate to the modular recogniser. The trained model is configured via
    # RECOGNITION_MODEL_PATH / MODEL_PATH. Until a model is deployed, this
    # endpoint returns an honest "not configured" result and never fabricates a
    # sign.
    recognizer = Recognizer()
    try:
        result = recognizer.predict(landmarks)
    except Exception as exc:
        return JsonResponse({'error': f'Recogniser error: {exc!s}'}, status=500)

    # Persist to history when a real sign is returned and we have a user.
    label = result.get('label')
    confidence = result.get('confidence') or 0.0
    if label and label != '—' and request.user.is_authenticated:
        # Try to link a matching Gesture definition.
        try:
            gesture = tmodels.Gesture.objects.filter(slug=label.lower()).first()
            if not gesture and label != '—':
                gesture = None
        except Exception:
            gesture = None

        tmodels.RecognitionHistory.objects.create(
            user=request.user,
            gesture=gesture,
            label=label,
            confidence=confidence,
            device=request.META.get('HTTP_USER_AGENT', '')[:32],
        )

    # If the model is not configured, return a clear, honest response.
    if not is_model_configured():
        result['model_configured'] = False
        result['message'] = 'No trained model is deployed. Set RECOGNITION_MODEL_PATH to the trained model file.'
    else:
        result['model_configured'] = True

    return JsonResponse(result)
