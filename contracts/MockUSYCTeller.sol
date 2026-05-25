// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Testnet-only mock that stands in for the USYC subscription/redemption teller.
 *
 * deposit / buy  — pulls USDC from msg.sender, mints mUSYC 1:1 to recipient.
 * redeem / sell  — pulls mUSYC from msg.sender, burns it, returns USDC + yield.
 *
 * Yield is simulated: on each redemption the teller pays back
 * principal × (10_000 + yieldBps) / 10_000.  The teller must hold enough
 * USDC to cover the surplus; if it doesn't the surplus is silently waived
 * (principal is still returned in full).
 *
 * Seed the teller with USDC after deployment to fund simulated yield.
 */
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IMockUSYCToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockUSYCTeller {
    IERC20Minimal public immutable usdc;
    IMockUSYCToken public immutable usycToken;

    // 100 bps = 1 % simulated yield per redemption
    uint256 public yieldBps = 100;
    address public owner;

    event Deposited(address indexed caller, address indexed recipient, uint256 usdcIn, uint256 usycOut);
    event Redeemed(address indexed caller, address indexed recipient, uint256 usycIn, uint256 usdcOut, uint256 yield);

    constructor(address _usdc, address _usycToken) {
        require(_usdc != address(0) && _usycToken != address(0), "zero address");
        usdc = IERC20Minimal(_usdc);
        usycToken = IMockUSYCToken(_usycToken);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setYieldBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "max 10%");
        yieldBps = bps;
    }

    // ─── Deposit / subscribe ────────────────────────────────────────────────

    function deposit(uint256 amount, address recipient) external returns (bool) {
        return _doDeposit(amount, recipient);
    }

    function buy(uint256 amount, address recipient) external returns (bool) {
        return _doDeposit(amount, recipient);
    }

    function _doDeposit(uint256 amount, address recipient) internal returns (bool) {
        require(amount > 0, "zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "usdc pull failed");
        usycToken.mint(recipient, amount); // 1:1 on testnet
        emit Deposited(msg.sender, recipient, amount, amount);
        return true;
    }

    // ─── Redeem / withdraw ──────────────────────────────────────────────────

    function redeem(uint256 shares, address recipient) external returns (bool) {
        return _doRedeem(shares, recipient);
    }

    function sell(uint256 shares, address recipient) external returns (bool) {
        return _doRedeem(shares, recipient);
    }

    function _doRedeem(uint256 shares, address recipient) internal returns (bool) {
        require(shares > 0, "zero shares");
        // Pull mUSYC from caller (caller must have approved this teller)
        require(usycToken.transferFrom(msg.sender, address(this), shares), "usyc pull failed");
        usycToken.burn(address(this), shares);

        // Principal always returned; surplus yield only if teller has reserve
        uint256 surplus = (shares * yieldBps) / 10_000;
        uint256 usdcOut = shares;
        uint256 reserve = usdc.balanceOf(address(this));

        if (reserve >= usdcOut + surplus) {
            usdcOut += surplus;
        } else if (reserve >= usdcOut) {
            // Enough for principal but not full yield — return what's available
            usdcOut = reserve;
            surplus = usdcOut - shares;
        } else if (reserve > 0) {
            // Partial — only pay what we have (edge case; teller under-funded)
            usdcOut = reserve;
            surplus = 0;
        }

        if (usdcOut > 0) {
            require(usdc.transfer(recipient, usdcOut), "usdc return failed");
        }
        emit Redeemed(msg.sender, recipient, shares, usdcOut, surplus);
        return true;
    }
}
