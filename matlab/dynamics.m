%% Parameters
N = 400;
L = 1;
nu = 2.5;
tmax = 1000;

%% Target field parameters
% STATIC targets: a rectangular lattice of point targets covering the plane
% (window [-grid_half, grid_half]^2). The spacing is set separately in x
% and in y. Every agent homes toward whichever target (static lattice point
% or the collector) is nearest to it, except agents stuck to the collector
% (see below), which home toward a blend of the collector and their nearest
% lattice target.
grid_half      = 50;
grid_spacing_x = 5;      % one static target every grid_spacing_x units in x
grid_spacing_y = 5;      % ... and every grid_spacing_y units in y

% CIRCULAR MOTION of the static lattice: it moves rigidly, so that its
% center travels on a circle of radius field_radius centered on the origin.
% At time t the lattice center is at field_radius*[cos(theta) sin(theta)]
% with theta = (field_speed/field_radius)*t, so one lap takes
% 2*pi*field_radius/field_speed steps.
field_speed  = 0.2;      % speed along the circle, units per time step (agents move at up to 1); negative = clockwise
field_radius = 20;       % radius of the circle (0 = the lattice stays put)
if field_radius > 0
    field_omega = field_speed/field_radius;   % angular velocity, rad per step
else
    field_omega = 0;
end

% ONE COLLECTOR target. It does not oscillate: it goes after the agents.
%   - Capture: an agent that comes within capture_radius of the collector
%     STICKS to it. A stuck agent homes toward a blend of the collector and
%     its nearest lattice target (weight field_weight, below), so it keeps
%     feeling the target field, until it drifts farther than release_radius,
%     at which point it is released and may be re-captured.
%   - Seeking: the collector moves toward the nearest agent that is not
%     stuck, at up to collector_speed. Once every agent is stuck it moves
%     to the centroid of the group and stays there.
%   - Keeping them close: the collector slows down in proportion to how
%     far the centroid of its stuck agents trails behind it, and stops
%     when that lag reaches keep_close, so it never runs away from the
%     agents it has collected. Its speed factor is max(0, 1 - lag/keep_close).
collector_speed = 0.4;       % top speed of the collector, units per time step (agents move at up to 1)
capture_radius  = 3;         % agents closer than this stick to the collector
release_radius  = 25;        % stuck agents farther than this are released
keep_close      = 5;         % lag of the stuck group's centroid at which the collector stops
collector_start = [30 0];    % where the collector starts

% FIELD WEIGHT for stuck agents. A stuck agent still feels the target field:
% its homing direction is the blend
%   (1-field_weight)*(unit vector to the collector) + field_weight*(unit vector to its nearest lattice target),
% and that homing term then goes through the normal VTP rules (length 1-s,
% repulsion priority, alignment, Voronoi speed governor) like every other
% agent. 0 = stuck agents ignore the field (old behaviour), 1 = they ignore
% the collector.
field_weight    = 0.5;

display=true;
fixframe = false;
frameinrad = 1.2*grid_half;   % with fixframe = true the frame is centered on the moving field

fdim = 1;
M0 = L;
if fdim==2
    M0 = pi*L^2/2;
end

filename='data.mat';
erase='';

%% Initial conditions
ic_rad=.5*sqrt(N*pi/4/.91);
rng(2);
X = ic_rad*(2*rand(N,2) - 1);
rng(18);
ang = 2*pi*rand(N,1);
U = [cos(ang) sin(ang)];

% ang = 2*pi*rand(N,1);
% n1 = rand(N,2);
% n2 = pi*rand(N,2);
% X = ic_rad*( [cos(ang) sin(ang)] + .2*n1 );
% U = [-sin(ang) cos(ang)] + .25*n2;

% sep = 10;
% X = zeros(N,2);
% X(:,2) = 4*rand(N,1) - 2;
% X(1:N/2,1) = -sep;
% X(N/2+1:end,1) = sep;
% U = zeros(N,2);
% U(1:N/2,1) = 1;
% U(N/2+1:end,1) = -1;

% rad = 3;
% sep = 4;
% r = rad*rand(N,1);
% a = 2*pi*rand(N,1);
% X = sqrt(r).*[cos(a) sin(a)];
% X(1:N/2,1) = X(1:N/2,1) + sep;
% X(N/2+1:end,1) = X(N/2+1:end,1) - sep;
% U = [-sin(a) cos(a)];

% X = zeros(N,2);
% X(1:N/2,2) = 5;
% X(N/2+1:end,2) = -5;
% X(:,1) = 100*rand(N,1) - 25;
% U = zeros(N,2);
% U(1:N/2,1) = 1;
% U(N/2+1,end) = -1;

%% Initialize targets

% sR = [sep sep; -4 4]';
% sL = [-sep -sep; -4 4]';
% R = [.8 .8 .6 .5; .7 .9 .9 .6]';
% tar = Target({sL,sR},[1 2]);
ids = ones(N,1);
ids(1:N/2) = 2;
% tar = Target(1*[1 -1 -1 1; 1 1 -1 -1]');
% tar = Target([0 0]);
% tar = Target({[-w/2 0],[w/2 0]});
tar_rad = 4;
tar_ang = 2*pi/3;
tar = Target({tar_rad*[1 0],tar_rad*[cos(tar_ang) sin(tar_ang)],tar_rad*[cos(2*tar_ang) sin(2*tar_ang)]});
% tar = Target();

% --- static lattice of point targets + the collector ------------------
[gx,gy] = meshgrid(-grid_half:grid_spacing_x:grid_half, -grid_half:grid_spacing_y:grid_half);
staticPts = [gx(:) gy(:)];
nStatic = size(staticPts,1);
fieldOff = @(t) field_radius*[cos(field_omega*t) sin(field_omega*t)];   % where the lattice center is at time t

% collector state: its position and which agents are stuck to it
cp    = collector_start;
stuck = false(N,1);

% tar holds the lattice points only (the target field). It is rebuilt every
% step below, because the lattice moves. The collector is handled
% separately in the homing step, so that stuck agents can feel both.
tar = Target(mat2cell(staticPts + fieldOff(0), ones(nStatic,1), 2));

%% Preallocation of some intermediate variables
[r,a,h0,h,s,l,rho] = deal(zeros(N,1));
U1 = zeros(N,2);
Q = zeros(N,2);

%% Preallocation of time series variables
U_t = zeros(N,2,tmax);
DT_t = cell(tmax,1);


for t = 1:tmax
%% Compute step

% --- collector: capture / release, then move ---------------------------
dc = hypot(X(:,1)-cp(1), X(:,2)-cp(2));          % distance of every agent to the collector
stuck = (stuck & dc <= release_radius) | (dc <= capture_radius);

if any(stuck)
    lag = norm(mean(X(stuck,:),1) - cp);         % how far the stuck group's centroid trails
    throttle = max(0, 1 - lag/keep_close);       % slow down (down to 0) if they fall behind
else
    throttle = 1;
end

if any(~stuck)
    Xf = X(~stuck,:);                            % seek the nearest agent that is not stuck yet
    [~,kf] = min(hypot(Xf(:,1)-cp(1), Xf(:,2)-cp(2)));
    goal = Xf(kf,:);
else
    goal = mean(X,1);                            % everyone is stuck: stay with the group
end
gvec  = goal - cp;
gdist = norm(gvec);
if gdist > 0
    cp = cp + gvec/gdist * min(collector_speed*throttle, gdist);
end

% move the lattice around its circle
off = fieldOff(t);
tar = Target(mat2cell(staticPts + off, ones(nStatic,1), 2));

DT = delaunayTriangulation(X);
DT_t{t} = DT;
U_t(:,:,t) = U;
[nbhd, nearest, d] = neighborhoods(DT);
fun = @(x) transition(x,'expReciprocal');
s = arrayfun(fun, d/L);

% repulsion
r = X - X(nearest,:);
rnorm = vecnorm(r,2,2);
r = s .* r./rnorm;  % rescale to length s

% alignment
a = alignTo(U,nbhd,'expReciprocal');

% homing
hF = homeToTarget(tar,X);           % toward the nearest lattice target (the field)
hC = cp - X;                        % toward the collector
dF = vecnorm(hF,2,2);
dC = vecnorm(hC,2,2);
h0 = hF;                            % free agents: nearest target of lattice + collector
useC = dC < dF;
h0(useC,:) = hC(useC,:);
uF = hF./dF;  uF(dF==0,:) = 0;      % unit vectors (0 if already on the target)
uC = hC./dC;  uC(dC==0,:) = 0;
% stuck agents keep feeling the field: blend of collector and nearest lattice target
h0(stuck,:) = (1-field_weight)*uC(stuck,:) + field_weight*uF(stuck,:);
h = (1-s) .* h0./vecnorm(h0,2,2);   % rescale to length 1-s (VTP homing)
h(isnan(h)) = 0;                    % protect 0 entries

% direction
U1 = (r + h + nu*a)./(1 + nu);

% speed
[~,l] = voronoiProjectToBoundary(DT,U1);
M = l;
if fdim==2
    M = voronoiForwardArea(DT,U1);
end

%% plot
if display==true
    clipToVoronoi=false;
    
    fig = figure(1);
    scatter(X(:,1), X(:,2), '.k');
    hold on
    scatter(X(stuck,1), X(stuck,2), 14, [0.95 0.5 0.1], 'filled');   % agents stuck to the collector
    % triplot(DT,'b');
    % text(X(:,1),X(:,2),num2cell(1:N));
    
    % vor = voronoi(DT);
    % vor(2).Color = 'k';
    
    qs = 1;
    % quiver(X(:,1),X(:,2),qs*r(:,1),qs*r(:,2),'off', 'r');
    % quiver(X(:,1),X(:,2),qs*h(:,1),qs*h(:,2),'off', 'g');
    % quiver(X(:,1),X(:,2),qs*a(:,1),qs*a(:,2), 'off', 'b');
    
    % quiver(X(:,1),X(:,2),qs*U(:,1),qs*U(:,2),'off', 'b');
    quiver(X(:,1),X(:,2),qs*U1(:,1),qs*U1(:,2), 'b');
    
    % plot([X(:,1) Q(:,1)]', [X(:,2) Q(:,2)]', 'r:', 'LineWidth', 1);
    % s = min(l);
    % quiver(X(:,1), X(:,2), s*U(:,1), s*U(:,2), 'off', 'r', 'ShowArrowHead', 1, 'LineWidth', 1);
    % scatter(Q(:,1), Q(:,2), '*b');
    
    C = tar.Components;
    for m=1:size(C,1)
        if isa(C{m},'polyshape')
            plot(C{m},'EdgeColor','none');
        end
    end
    
    % static lattice targets (grey), the collector (red) and its capture radius
    scatter(staticPts(:,1)+off(1), staticPts(:,2)+off(2), 25, [.5 .5 .5], 's');
    scatter(cp(1), cp(2), 80, 'r', 'filled');
    ang = linspace(0, 2*pi, 60);
    plot(cp(1)+capture_radius*cos(ang), cp(2)+capture_radius*sin(ang), 'r:');
    
    
    hold off
    
    clip = [min(X,[],1); max(X,[],1)];
    if clipToVoronoi==true
        V = voronoiDiagram(DT);
        clip = [min([V; X],[],1); max([V(2:end,:); X],[],1)];
    end
    clip_width = 1.2*max(clip(2,:)-clip(1,:));
    clip_center = mean(clip,1);
    clip_lim(1:4) = clip_center(ceil((1:4)/2)) - rescale(mod(1:4,2),-1,1)*.5*clip_width;
    
    axis equal
    
    
    frame = [-frameinrad frameinrad -frameinrad frameinrad] + [off(1) off(1) off(2) off(2)];
    if ~fixframe
        com = mean(X);
        rmed = sqrt(median((X(:,1)-com(1)).^2+(X(:,2)-com(2)).^2));
        frame = [com(1)-3*rmed com(1)+3*rmed com(2)-3*rmed com(2)+3*rmed];
    end
    axis(frame);
    title(['$t=',num2str(t),',\; \mathrm{stuck}=',num2str(nnz(stuck)),',\; v_{col}=',num2str(collector_speed),',\; v_{field}=',num2str(field_speed),',\; R_{field}=',num2str(field_radius),',\; w_{field}=',num2str(field_weight),'$'], 'Interpreter', 'Latex');
end

%% Update

U = tanh(M/M0).*U1;
X = X + U;

%% display progress

barwidth = 60;
frac = floor(t/tmax * barwidth);
fracpct = t/tmax*100;
sofar = repmat(sprintf('\x0023'),1,frac);
yet = repmat('-',1,barwidth-frac);
progbar = ['[' sofar yet ']' ' ' sprintf('%04.1f\t%s',fracpct,filename) newline];
fprintf([erase progbar]);
erase = repmat(sprintf('\b'),1,length(progbar));
end


save("data.mat",'DT_t','U_t');
