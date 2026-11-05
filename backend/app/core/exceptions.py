
class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        code: str = "APPLICATION_ERROR",
        status_code: int = 500,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class WialonException(AppException):
    """Base exception for Wialon integration errors."""

    def __init__(
        self,
        message: str,
        code: str = "WIALON_ERROR",
        status_code: int = 502,
    ):
        super().__init__(message, code, status_code)


class WialonAuthenticationException(WialonException):
    """Raised when Wialon authentication fails."""

    def __init__(self, message: str = "Wialon authentication failed"):
        super().__init__(
            message,
            code="WIALON_AUTHENTICATION_ERROR",
            status_code=502,
        )


class WialonUnavailableException(WialonException):
    """Raised when Wialon is unavailable."""

    def __init__(self, message: str = "Wialon service unavailable"):
        super().__init__(
            message,
            code="WIALON_UNAVAILABLE",
            status_code=503,
        )
